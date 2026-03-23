package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
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
	if req.ThumbMediaID == "" {
		http.Error(w, `{"error":"thumb_media_id required, please upload cover image first via POST /api/materials/thumb"}`, http.StatusBadRequest)
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
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var mediaID, imageURL string
	var err error

	// 判断 Content-Type
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "multipart/form-data") {
		// 方式1: 文件上传（人工表单）
		mediaID, imageURL, err = s.handleFileUpload(w, r)
	} else {
		// 方式2: JSON Base64（Kimi程序化调用）
		mediaID, imageURL, err = s.handleBase64Upload(w, r)
	}

	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%v"}`, err), http.StatusBadRequest)
		return
	}

	// 返回成功
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"thumb_media_id": mediaID,
		"url":            imageURL,
		"created_at":     time.Now().Format(time.RFC3339),
	})
}

// handleFileUpload 处理 multipart 文件上传
func (s *Server) handleFileUpload(w http.ResponseWriter, r *http.Request) (string, string, error) {
	// 解析表单，最大内存32MB
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		return "", "", fmt.Errorf("parse form failed: %v", err)
	}

	file, handler, err := r.FormFile("image")
	if err != nil {
		return "", "", fmt.Errorf("get file failed: %v", err)
	}
	defer file.Close()

	// 验证文件类型
	ext := strings.ToLower(filepath.Ext(handler.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		return "", "", fmt.Errorf("only jpg/png allowed, got: %s", ext)
	}

	// 保存临时文件
	tmpDir := "/tmp/wechat_thumbs"
	os.MkdirAll(tmpDir, 0755)

	tmpFile := filepath.Join(tmpDir, fmt.Sprintf("%d%s", time.Now().UnixNano(), ext))
	dst, err := os.Create(tmpFile)
	if err != nil {
		return "", "", fmt.Errorf("create temp file failed: %v", err)
	}
	defer os.Remove(tmpFile) // 清理临时文件
	defer dst.Close()

	// 写入文件并检查大小
	written, err := io.Copy(dst, file)
	if err != nil {
		return "", "", fmt.Errorf("save file failed: %v", err)
	}
	if written > 2*1024*1024 {
		return "", "", fmt.Errorf("file size %d bytes exceeds 2MB limit", written)
	}
	dst.Close() // 提前关闭确保写入完成

	// 上传到微信获取 thumb_media_id
	return s.wechat.UploadThumb(tmpFile)
}

// handleBase64Upload 处理 Base64 图片（Kimi 用）
func (s *Server) handleBase64Upload(w http.ResponseWriter, r *http.Request) (string, string, error) {
	var req struct {
		Image string `json:"image"` // data:image/jpeg;base64,/9j/4AAQ...
		Name  string `json:"name"`  // 可选文件名
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return "", "", fmt.Errorf("invalid json: %v", err)
	}

	if req.Image == "" {
		return "", "", fmt.Errorf("image base64 required")
	}

	// 解析 base64
	var ext string
	var base64Data string

	if strings.Contains(req.Image, ",") {
		// data:image/jpeg;base64,/9j/4AAQ... 格式
		parts := strings.SplitN(req.Image, ",", 2)
		meta := parts[0]
		base64Data = parts[1]

		if strings.Contains(meta, "jpeg") || strings.Contains(meta, "jpg") {
			ext = ".jpg"
		} else if strings.Contains(meta, "png") {
			ext = ".png"
		} else {
			ext = ".jpg" // 默认
		}
	} else {
		// 纯 base64 字符串
		base64Data = req.Image
		ext = ".jpg"
	}

	// 解码
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return "", "", fmt.Errorf("base64 decode failed: %v", err)
	}

	if len(data) > 2*1024*1024 {
		return "", "", fmt.Errorf("image size %d bytes exceeds 2MB limit", len(data))
	}

	// 保存临时文件
	tmpDir := "/tmp/wechat_thumbs"
	os.MkdirAll(tmpDir, 0755)

	fileName := req.Name
	if fileName == "" {
		fileName = fmt.Sprintf("cover_%d%s", time.Now().UnixNano(), ext)
	}
	tmpFile := filepath.Join(tmpDir, fileName)

	if err := os.WriteFile(tmpFile, data, 0644); err != nil {
		return "", "", fmt.Errorf("save temp file failed: %v", err)
	}
	defer os.Remove(tmpFile)

	// 上传到微信获取 thumb_media_id
	return s.wechat.UploadThumb(tmpFile)
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
