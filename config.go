package main

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	ServerPort   string
	APIKey       string // Kimi Claw璁块棶闇€瑕佺殑API Key
	WechatAppID  string
	WechatSecret string
	DBPath       string
	WorkerCount  int           // 骞跺彂宸ヤ綔鏁?
	TaskTimeout  time.Duration // 鍗曚釜浠诲姟瓒呮椂
}

func LoadConfig() *Config {
	return &Config{
		ServerPort:   getEnv("PORT", "8080"),
		APIKey:       getEnv("API_KEY", "change-me-in-production"),
		WechatAppID:  getEnv("WECHAT_APPID", ""),
		WechatSecret: getEnv("WECHAT_SECRET", ""),
		DBPath:       getEnv("DB_PATH", "./data/publisher.db"),
		WorkerCount:  getEnvInt("WORKER_COUNT", 3),
		TaskTimeout:  getEnvDuration("TASK_TIMEOUT", 120),
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}

func getEnvDuration(key string, defaultVal time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return time.Duration(i) * time.Second
		}
	}
	return defaultVal * time.Second
}
