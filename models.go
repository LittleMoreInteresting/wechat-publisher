package main

import (
	"database/sql"
	"time"

	_ "modernc.org/sqlite"
)

type DraftTask struct {
	ID           string     `json:"id"`
	Status       string     `json:"status"` // pending, processing, success, failed
	Title        string     `json:"title"`
	Content      string     `json:"content"`        // Markdown格式，包含base64图片
	ThumbMediaID string     `json:"thumb_media_id"` // 封面图素材ID
	Author       string     `json:"author"`
	Digest       string     `json:"digest"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	ErrorMessage string     `json:"error_message,omitempty"`
	MediaID      string     `json:"media_id,omitempty"`    // 微信返回的草稿ID
	PreviewURL   string     `json:"preview_url,omitempty"` // 预览链接
}

type TaskStore struct {
	db *sql.DB
}

func NewTaskStore(dbPath string) (*TaskStore, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	// 创建表
	schema := `
	CREATE TABLE IF NOT EXISTS draft_tasks (
		id TEXT PRIMARY KEY,
		status TEXT DEFAULT 'pending',
		title TEXT,
		content TEXT,
		thumb_media_id TEXT,
		author TEXT,
		digest TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		completed_at DATETIME,
		error_message TEXT,
		media_id TEXT,
		preview_url TEXT
	);
	CREATE INDEX IF NOT EXISTS idx_status ON draft_tasks(status);
	CREATE INDEX IF NOT EXISTS idx_created ON draft_tasks(created_at);
	`
	if _, err := db.Exec(schema); err != nil {
		return nil, err
	}
	return &TaskStore{db: db}, nil
}

func (s *TaskStore) Create(task *DraftTask) error {
	_, err := s.db.Exec(
		`INSERT INTO draft_tasks (id, status, title, content, thumb_media_id, author, digest) 
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		task.ID, task.Status, task.Title, task.Content, task.ThumbMediaID, task.Author, task.Digest,
	)
	return err
}

func (s *TaskStore) UpdateStatus(id, status, mediaID, previewURL, errMsg string) error {
	now := time.Now()
	_, err := s.db.Exec(
		`UPDATE draft_tasks SET status=?, media_id=?, preview_url=?, error_message=?, completed_at=? 
		 WHERE id=?`,
		status, mediaID, previewURL, errMsg, now, id,
	)
	return err
}

func (s *TaskStore) Get(id string) (*DraftTask, error) {
	row := s.db.QueryRow(
		`SELECT id, status, title, content, thumb_media_id, author, digest, created_at, 
		        completed_at, error_message, media_id, preview_url 
		 FROM draft_tasks WHERE id=?`, id,
	)

	t := &DraftTask{}
	var completedAt sql.NullTime
	err := row.Scan(&t.ID, &t.Status, &t.Title, &t.Content, &t.ThumbMediaID, &t.Author,
		&t.Digest, &t.CreatedAt, &completedAt, &t.ErrorMessage, &t.MediaID, &t.PreviewURL)
	if err != nil {
		return nil, err
	}
	if completedAt.Valid {
		t.CompletedAt = &completedAt.Time
	}
	return t, nil
}

func (s *TaskStore) List(limit int) ([]DraftTask, error) {
	rows, err := s.db.Query(
		`SELECT id, status, title, created_at, media_id FROM draft_tasks 
		 ORDER BY created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []DraftTask
	for rows.Next() {
		t := DraftTask{}
		rows.Scan(&t.ID, &t.Status, &t.Title, &t.CreatedAt, &t.MediaID)
		tasks = append(tasks, t)
	}
	return tasks, nil
}
