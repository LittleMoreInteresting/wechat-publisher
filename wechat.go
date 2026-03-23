package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type WechatClient struct {
	appID       string
	appSecret   string
	httpClient  *http.Client
	tokenMutex  sync.RWMutex
	accessToken string
	expiresAt   time.Time
}

func NewWechatClient(appID, appSecret string) *WechatClient {
	return &WechatClient{
		appID:      appID,
		appSecret:  appSecret,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// GetAccessToken 带缓存的Token获取
func (c *WechatClient) GetAccessToken() (string, error) {
	c.tokenMutex.RLock()
	if time.Now().Before(c.expiresAt.Add(-5 * time.Minute)) {
		token := c.accessToken
		c.tokenMutex.RUnlock()
		return token, nil
	}
	c.tokenMutex.RUnlock()

	// 需要刷新
	c.tokenMutex.Lock()
	defer c.tokenMutex.Unlock()

	// 双重检查
	if time.Now().Before(c.expiresAt.Add(-5 * time.Minute)) {
		return c.accessToken, nil
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		c.appID, c.appSecret)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if result.ErrCode != 0 {
		return "", fmt.Errorf("wechat error: %s", result.ErrMsg)
	}

	c.accessToken = result.AccessToken
	c.expiresAt = time.Now().Add(time.Duration(result.ExpiresIn) * time.Second)
	return c.accessToken, nil
}

// UploadImage 上传正文图片，返回URL
func (c *WechatClient) UploadImage(filePath string) (string, error) {
	token, err := c.GetAccessToken()
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=%s", token)

	// 构建multipart
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	part, err := writer.CreateFormFile("media", filepath.Base(filePath))
	if err != nil {
		return "", err
	}
	io.Copy(part, file)
	writer.Close()

	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		URL     string `json:"url"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if result.ErrCode != 0 {
		return "", fmt.Errorf("upload image failed: %s", result.ErrMsg)
	}

	return result.URL, nil
}

// CreateDraft 创建草稿
func (c *WechatClient) CreateDraft(article Article) (string, string, error) {
	token, err := c.GetAccessToken()
	if err != nil {
		return "", "", err
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/draft/add?access_token=%s", token)

	reqBody := struct {
		Articles []Article `json:"articles"`
	}{Articles: []Article{article}}

	jsonData, _ := json.Marshal(reqBody)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	var result struct {
		MediaID string `json:"media_id"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}

	if result.ErrCode != 0 {
		return "", "", fmt.Errorf("create draft failed: %s", result.ErrMsg)
	}

	// 生成预览链接（通过微信网页版预览接口）
	previewURL := fmt.Sprintf("https://mp.weixin.qq.com/s?__biz=%s&tempkey=...", result.MediaID)

	return result.MediaID, previewURL, nil
}

type Article struct {
	Title              string `json:"title"`
	Content            string `json:"content"`        // HTML格式
	ThumbMediaID       string `json:"thumb_media_id"` // 封面素材ID
	Author             string `json:"author"`
	Digest             string `json:"digest"`
	ShowCoverPic       int    `json:"show_cover_pic"` // 1显示
	ContentSourceURL   string `json:"content_source_url"`
	NeedOpenComment    int    `json:"need_open_comment"`     // 1开启
	OnlyFansCanComment int    `json:"only_fans_can_comment"` // 0所有人，1粉丝
}
