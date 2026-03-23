package main

import (
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

type PublishEngine struct {
	store    *TaskStore
	wechat   *WechatClient
	config   *Config
	taskChan chan DraftTask
	wg       sync.WaitGroup
}

func NewPublishEngine(store *TaskStore, wechat *WechatClient, config *Config) *PublishEngine {
	return &PublishEngine{
		store:    store,
		wechat:   wechat,
		config:   config,
		taskChan: make(chan DraftTask, 100), // 缓冲队列防止爆发
	}
}

func (e *PublishEngine) Start() {
	for i := 0; i < e.config.WorkerCount; i++ {
		e.wg.Add(1)
		go e.worker(i)
	}
}

func (e *PublishEngine) Stop() {
	close(e.taskChan)
	e.wg.Wait()
}

func (e *PublishEngine) Submit(task DraftTask) {
	e.taskChan <- task
}

func (e *PublishEngine) worker(id int) {
	defer e.wg.Done()

	for task := range e.taskChan {
		fmt.Printf("[Worker-%d] 处理任务: %s\n", id, task.ID)
		e.processTask(task)
	}
}

func (e *PublishEngine) processTask(task DraftTask) {
	// 更新状态为处理中
	e.store.UpdateStatus(task.ID, "processing", "", "", "")

	// 创建超时上下文
	done := make(chan struct{})
	var resultErr error
	var mediaID, previewURL string

	go func() {
		defer close(done)

		// 1. 处理Base64图片
		htmlContent, err := e.processImages(task.Content)
		if err != nil {
			resultErr = fmt.Errorf("process images failed: %v", err)
			return
		}

		// 2. Markdown转HTML（如果不是HTML的话）
		if !strings.Contains(htmlContent, "<html") {
			htmlContent = e.markdownToHTML(htmlContent)
		}

		// 3. 创建微信草稿
		article := Article{
			Title:              task.Title,
			Content:            htmlContent,
			ThumbMediaID:       task.ThumbMediaID,
			Author:             task.Author,
			Digest:             task.Digest,
			ShowCoverPic:       1,
			NeedOpenComment:    1,
			OnlyFansCanComment: 0,
		}

		mediaID, previewURL, resultErr = e.wechat.CreateDraft(article)
	}()

	// 等待完成或超时
	select {
	case <-done:
		if resultErr != nil {
			e.store.UpdateStatus(task.ID, "failed", "", "", resultErr.Error())
		} else {
			e.store.UpdateStatus(task.ID, "success", mediaID, previewURL, "")
		}
	case <-time.After(e.config.TaskTimeout * time.Second):
		e.store.UpdateStatus(task.ID, "timeout", "", "", "任务处理超时")
	}
}

// processImages 提取Base64图片，上传到微信，替换为URL
func (e *PublishEngine) processImages(content string) (string, error) {
	// 正则匹配base64图片: data:image/png;base64,xxxx
	re := regexp.MustCompile(`data:image/(png|jpeg|jpg|gif);base64,([A-Za-z0-9+/=]+)`)
	matches := re.FindAllStringSubmatch(content, -1)

	result := content
	for i, match := range matches {
		if len(match) < 3 {
			continue
		}

		imgType := match[1]
		base64Data := match[2]

		// 解码
		data, err := base64.StdEncoding.DecodeString(base64Data)
		if err != nil {
			continue
		}

		// 保存临时文件
		tmpFile := fmt.Sprintf("/tmp/img_%d_%d.%s", time.Now().Unix(), i, imgType)
		if err := ioutil.WriteFile(tmpFile, data, 0644); err != nil {
			continue
		}
		defer os.Remove(tmpFile)

		// 上传到微信
		url, err := e.wechat.UploadImage(tmpFile)
		if err != nil {
			return "", fmt.Errorf("upload image %d failed: %v", i, err)
		}

		// 替换base64为微信URL
		result = strings.Replace(result, match[0], url, 1)
	}

	return result, nil
}

func (e *PublishEngine) markdownToHTML(markdown string) string {
	var buf strings.Builder
	md := goldmark.New(
		goldmark.WithExtensions(extension.Table, extension.Strikethrough),
	)
	if err := md.Convert([]byte(markdown), &buf); err != nil {
		return markdown // 转换失败返回原文
	}

	// 添加微信专用样式
	html := buf.String()
	html = strings.ReplaceAll(html, "<pre><code>", `<pre style="background:#f6f8fa;padding:12px;border-radius:4px;overflow-x:auto;">`)
	html = strings.ReplaceAll(html, "<blockquote>", `<blockquote style="border-left:4px solid #1aad19;padding-left:12px;color:#666;margin:12px 0;">`)
	html = strings.ReplaceAll(html, "<img src=", `<img style="max-width:100%;display:block;margin:12px auto;" src=`)

	return html
}
