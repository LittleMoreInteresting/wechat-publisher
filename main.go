package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
)

type Server struct {
	config *Config
	store  *TaskStore
	wechat *WechatClient
	engine *PublishEngine
}

func main() {
	config := LoadConfig()

	// 确保数据目录存在
	os.MkdirAll("./data", 0755)

	// 初始化存储
	store, err := NewTaskStore(config.DBPath)
	if err != nil {
		panic(fmt.Sprintf("数据库初始化失败: %v", err))
	}

	// 初始化微信客户端
	wechat := NewWechatClient(config.WechatAppID, config.WechatSecret)

	// 初始化发布引擎
	engine := NewPublishEngine(store, wechat, config)
	engine.Start()
	defer engine.Stop()

	server := &Server{
		config: config,
		store:  store,
		wechat: wechat,
		engine: engine,
	}

	// 设置路由
	mux := http.NewServeMux()
	mux.HandleFunc("/health", server.handleHealth)
	mux.HandleFunc("/api/drafts", server.authMiddleware(server.handleCreateDraft))
	mux.HandleFunc("/api/drafts/", server.authMiddleware(server.handleGetDraft))
	mux.HandleFunc("/api/materials/thumb", server.authMiddleware(server.handleUploadThumb)) // 上传封面图

	srv := &http.Server{
		Addr:    ":" + config.ServerPort,
		Handler: mux,
	}

	// 优雅关闭
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	fmt.Printf("Server starting on port %s\n", config.ServerPort)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		panic(err)
	}
}

// 认证中间件
func (s *Server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		apiKey := r.Header.Get("X-API-Key")
		if apiKey != s.config.APIKey {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// 创建草稿（异步）
func (s *Server) handleCreateDraft(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Title        string `json:"title"`
		Content      string `json:"content"`        // 支持Markdown，包含base64图片
		ThumbMediaID string `json:"thumb_media_id"` // 封面图素材ID（需先上传）
		Author       string `json:"author"`
		Digest       string `json:"digest"` // 摘要，不传则自动提取
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	// 验证
	if req.Title == "" || req.Content == "" {
		http.Error(w, `{"error":"title and content required"}`, http.StatusBadRequest)
		return
	}

	// 生成任务ID
	taskID := uuid.New().String()[:8]

	// 如果没有摘要，提取前54字
	if req.Digest == "" {
		req.Digest = extractDigest(req.Content)
	}

	task := DraftTask{
		ID:           taskID,
		Status:       "pending",
		Title:        req.Title,
		Content:      req.Content,
		ThumbMediaID: req.ThumbMediaID,
		Author:       req.Author,
		Digest:       req.Digest,
		CreatedAt:    time.Now(),
	}

	// 保存到数据库
	if err := s.store.Create(&task); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusInternalServerError)
		return
	}

	// 提交到异步队列（立即返回）
	s.engine.Submit(task)

	// 立即返回任务ID
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"task_id":   taskID,
		"status":    "pending",
		"check_url": fmt.Sprintf("/api/drafts/%s", taskID),
		"message":   "任务已提交，请通过check_url查询状态",
	})
}

// 查询任务状态
func (s *Server) handleGetDraft(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 提取ID: /api/drafts/xxx
	path := r.URL.Path
	id := strings.TrimPrefix(path, "/api/drafts/")
	if id == "" {
		http.Error(w, `{"error":"id required"}`, http.StatusBadRequest)
		return
	}

	task, err := s.store.Get(id)
	if err != nil {
		http.Error(w, `{"error":"task not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

// 上传缩略图（获取thumb_media_id）
func (s *Server) handleUploadThumb(w http.ResponseWriter, r *http.Request) {
	// 简化版：接收文件上传，返回media_id
	// 实际实现需要解析multipart/form-data，调用微信add_material接口
	http.Error(w, "not implemented", http.StatusNotImplemented)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte(`{"status":"ok"}`))
}

func extractDigest(content string) string {
	// 移除markdown标记，取纯文本前54字
	text := strings.ReplaceAll(content, "#", "")
	text = strings.ReplaceAll(text, "*", "")
	text = strings.ReplaceAll(text, "`", "")
	text = strings.TrimSpace(text)
	if len(text) > 54 {
		return text[:54] + "..."
	}
	return text
}
