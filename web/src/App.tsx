import { useState, useCallback, useRef } from 'react'
import { 
  Edit3, 
  Copy, 
  Check, 
  FileText, 
  Upload,
  Send,
  Smartphone,
  Code,
  X
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import './App.css'
import './wechat-styles.css'

// 默认示例内容
const DEFAULT_CONTENT = `# 这里是文章标题

> 💡 这是一篇示例文章，左侧编辑，右侧实时预览

## 为什么要写公众号？

**公众号** 是连接你和读者的桥梁。通过优质的内容，你可以：

- 📚 分享知识和经验
- 💬 建立个人品牌
- 🚀 扩大影响力

## 排版小技巧

### 1. 清晰的结构

使用标题层级让文章更有层次感：

| 层级 | 用途 |
|------|------|
| H1 | 主标题 |
| H2 | 章节标题 |
| H3 | 小节标题 |

### 2. 适当的装饰

> 引用块可以用来强调重点内容

**加粗** 和 *斜体* 能突出重点

### 3. 代码展示

行内代码：\`const example = "Hello"\`

代码块：

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

### 4. 列表排版

有序列表：
1. 第一步：准备素材
2. 第二步：撰写内容
3. 第三步：排版美化

无序列表：
- 使用简洁的语言
- 添加适当的图片
- 保持段落简短

---

**开始创作你的精彩内容吧！** 🎉
`

function App() {
  const [markdown, setMarkdown] = useState(DEFAULT_CONTENT)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [copied, setCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showHtmlModal, setShowHtmlModal] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理 Markdown 变化
  const handleMarkdownChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdown(e.target.value)
  }, [])

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith('.md')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setMarkdown(content)
      }
      reader.readAsText(file)
    } else if (file) {
      alert('请选择 .md 格式的文件')
    }
    // 重置 input 值，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 生成可直接粘贴到公众号的 HTML
  const generateWechatHtml = (): string => {
    if (!contentRef.current) return ''
    
    // 获取原始 HTML
    const rawHtml = contentRef.current.innerHTML
    
    // 转换为微信兼容的格式
    return generateInlineStyledHtml(rawHtml)
  }

  // 将 class 转换为内联样式（微信公众号编辑器需要）
  const generateInlineStyledHtml = (html: string): string => {
    // 先移除 React 生成的特殊属性
    let styledHtml = html
      .replace(/ data-[^=]*="[^"]*"/g, '')
      .replace(/ aria-[^=]*="[^"]*"/g, '')
      .replace(/ id="[^"]*"/g, '')
    
    const styleMap: Record<string, string> = {
      // 段落
      'wx-p': 'margin: 0 0 20px 0; line-height: 1.85; text-align: justify; font-size: 17px; color: #333;',
      
      // 标题 - 带背景色卡片
      'wx-h1': 'font-size: 20px; font-weight: 700; line-height: 1.4; margin: 32px 0 18px 0; color: #fff; padding: 14px 18px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); letter-spacing: 0.5px;',
      
      'wx-h2': 'font-size: 18px; font-weight: 650; line-height: 1.4; margin: 28px 0 15px 0; color: #333; padding: 12px 16px; background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%); border-radius: 10px; border-left: 4px solid #07c160; box-shadow: 0 2px 8px rgba(0,0,0,0.04);',
      
      'wx-h3': 'font-size: 17px; font-weight: 650; line-height: 1.4; margin: 22px 0 12px 0; color: #333; padding: 10px 14px; background: linear-gradient(135deg, #fff9f0 0%, #fff3e0 100%); border-radius: 8px; border-left: 3px solid #ff9500;',
      
      // 引用块
      'wx-blockquote': 'margin: 22px 0; padding: 20px 22px 20px 44px; background: linear-gradient(135deg, #f0f9f4 0%, #e8f5ee 100%); border-radius: 12px; font-size: 16px; line-height: 1.8; color: #2c5f3f; box-shadow: 0 2px 8px rgba(7, 193, 96, 0.08), inset 0 0 0 1px rgba(7, 193, 96, 0.1); position: relative;',
      
      // 行内代码
      'wx-code-inline': 'font-family: "SF Mono", "JetBrains Mono", monospace; font-size: 0.88em; padding: 3px 8px; background: linear-gradient(135deg, #f1f3f4 0%, #e8eaed 100%); border-radius: 5px; color: #e83e8c; font-weight: 500; border: 1px solid rgba(0,0,0,0.06);',
      
      // 代码块 - macOS 风格
      'wx-pre': 'margin: 20px 0; background: #1e1e2e; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15);',
      
      'wx-code': 'font-family: "SF Mono", "JetBrains Mono", "Fira Code", monospace; font-size: 14px; line-height: 1.7; color: #a6accd; background: transparent; padding: 16px 18px; display: block; white-space: pre; word-wrap: normal; overflow-x: auto; -webkit-overflow-scrolling: touch;',
      
      // 列表
      'wx-ul': 'margin: 18px 0; padding-left: 20px; list-style-type: none;',
      
      'wx-ol': 'margin: 18px 0; padding-left: 20px; list-style-type: none; counter-reset: item;',
      
      'wx-li': 'margin: 12px 0; line-height: 1.8; font-size: 17px; color: #333; position: relative;',
      
      // 表格
      'wx-table': 'width: 100%; border-collapse: separate; border-spacing: 0; font-size: 15px; line-height: 1.5;',
      
      'wx-table-wrapper': 'margin: 20px 0; overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); background: #fff;',
      
      // 分割线
      'wx-hr': 'margin: 36px 0; border: none; height: 2px; background: linear-gradient(90deg, transparent 0%, #e0e0e0 15%, #667eea 30%, #764ba2 50%, #667eea 70%, #e0e0e0 85%, transparent 100%); position: relative;',
      
      // 链接
      'wx-a': 'color: #576b95; text-decoration: none; font-weight: 500; padding: 2px 4px; border-radius: 4px; transition: all 0.2s;',
      
      // 图片
      'wx-img': 'max-width: 100%; height: auto; display: block; margin: 20px auto; border-radius: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.12);',
    }

    // 转换所有 class 为内联样式
    Object.entries(styleMap).forEach(([className, style]) => {
      // 处理 class="wx-xxx"
      const classRegex = new RegExp(`class="${className}"`, 'g')
      styledHtml = styledHtml.replace(classRegex, `style="${style}"`)
    })

    // 为 strong/b 添加样式
    styledHtml = styledHtml.replace(
      /<strong>/g,
      '<strong style="font-weight: 700; color: #000; background: linear-gradient(180deg, transparent 60%, rgba(102, 126, 234, 0.2) 60%); padding: 0 2px;">'
    )

    // 为 em/i 添加样式
    styledHtml = styledHtml.replace(
      /<em>/g,
      '<em style="font-style: italic; color: #555;">'
    )

    // 处理无序列表项 - 添加自定义圆点
    styledHtml = styledHtml.replace(
      /<ul style="[^"]*">/g,
      '<ul style="margin: 18px 0; padding-left: 20px; list-style-type: none;">'
    )
    
    styledHtml = styledHtml.replace(
      /<li style="[^"]*">/g,
      '<li style="margin: 12px 0; line-height: 1.8; font-size: 17px; color: #333; position: relative;">'
    )
    
    // 为 ul 下的 li 添加圆点标记
    styledHtml = styledHtml.replace(
      /(<ul[^>]*>[\s\S]*?)<li style="position: relative;">/g,
      '$1<li style="margin: 12px 0; line-height: 1.8; font-size: 17px; color: #333; position: relative;"><span style="position: absolute; left: -18px; top: 10px; width: 8px; height: 8px; background: linear-gradient(135deg, #07c160 0%, #00d4aa 100%); border-radius: 50%;"></span>'
    )

    // 为有序列表添加计数器样式
    styledHtml = styledHtml.replace(
      /<ol style="[^"]*">/g,
      '<ol style="margin: 18px 0; padding-left: 20px; list-style-type: none; counter-reset: item;">'
    )
    
    styledHtml = styledHtml.replace(
      /<ol[^>]*>[\s\S]*?<li style="position: relative;">/g,
      (match) => {
        let counter = 0
        return match.replace(
          /<li style="position: relative;">/g,
          () => {
            counter++
            return `<li style="margin: 12px 0; line-height: 1.8; font-size: 17px; color: #333; position: relative;"><span style="position: absolute; left: -26px; top: 2px; width: 20px; height: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; font-size: 12px; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${counter}</span>`
          }
        )
      }
    )

    // 为表格表头添加圆角和样式
    styledHtml = styledHtml.replace(
      /<th>/g,
      '<th style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; text-align: left; background: linear-gradient(180deg, #667eea 0%, #5a6fd6 100%); color: #fff; font-weight: 600;">'
    )
    
    styledHtml = styledHtml.replace(
      /<td>/g,
      '<td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; text-align: left;">'
    )

    // 为代码块添加 macOS 标题栏
    styledHtml = styledHtml.replace(
      /<pre style="[^"]*">/g,
      '<pre style="margin: 20px 0; background: #1e1e2e; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15);"><div style="height: 36px; background: linear-gradient(180deg, #2d2d3a 0%, #252532 100%); border-bottom: 1px solid #1a1a25; background-image: radial-gradient(circle at 20px 18px, #ff5f56 6px, transparent 6px), radial-gradient(circle at 40px 18px, #ffbd2e 6px, transparent 6px), radial-gradient(circle at 60px 18px, #27c93f 6px, transparent 6px);"></div>'
    )

    // 清理空 style 和 class
    styledHtml = styledHtml.replace(/ style=""/g, '')
    styledHtml = styledHtml.replace(/ class=""/g, '')
    
    // 移除所有剩余的 class 属性
    styledHtml = styledHtml.replace(/ class="[^"]*"/g, '')
    
    // 清理多余的空白和换行
    styledHtml = styledHtml.replace(/\n\s*\n/g, '\n')
    
    // 确保段落之后有换行便于阅读
    styledHtml = styledHtml.replace(/<\/p>/g, '</p>\n')

    return styledHtml.trim()
  }

  // 复制 HTML 到剪贴板 - 使用 text/html MIME 类型
  const handleCopyHtml = async () => {
    const html = generateWechatHtml()
    if (!html) return

    try {
      // 创建富文本格式的 ClipboardItem
      const htmlBlob = new Blob([html], { type: 'text/html' })
      const textBlob = new Blob([html.replace(/<[^>]*>/g, '')], { type: 'text/plain' })
      
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob
      })
      
      await navigator.clipboard.write([clipboardItem])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('富文本复制失败，尝试纯文本:', err)
      // fallback: 直接使用 writeText
      try {
        await navigator.clipboard.writeText(html)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err2) {
        console.error('复制失败:', err2)
        alert('复制失败，请手动复制')
      }
    }
  }

  // 提交到公众号（模拟）
  const handleSubmit = async () => {
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsSubmitting(false)
    alert('文章已提交到公众号草稿箱！')
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <FileText size={24} />
            <span>公众号排版助手</span>
          </div>
        </div>
        
        <div className="header-center">
          <div className="tab-switcher">
            <button 
              className={activeTab === 'edit' ? 'active' : ''}
              onClick={() => setActiveTab('edit')}
            >
              <Edit3 size={16} />
              <span>编辑</span>
            </button>
            <button 
              className={activeTab === 'preview' ? 'active' : ''}
              onClick={() => setActiveTab('preview')}
            >
              <Smartphone size={16} />
              <span>预览</span>
            </button>
          </div>
        </div>

        <div className="header-right">
          <button className="btn-secondary" onClick={() => setShowHtmlModal(true)}>
            <Code size={16} />
            <span>查看HTML</span>
          </button>
          <button className="btn-secondary" onClick={handleCopyHtml}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? '已复制' : '复制公众号HTML'}</span>
          </button>
          <button 
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="loading">提交中...</span>
            ) : (
              <>
                <Send size={16} />
                <span>发布</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* 左侧：编辑器 */}
        <div className={`editor-panel ${activeTab === 'edit' ? 'active' : ''}`}>
          <div className="panel-header">
            <span className="panel-title">
              <Edit3 size={14} />
              Markdown 编辑器
            </span>
            <div className="panel-actions">
              <input
                type="file"
                accept=".md"
                onChange={handleFileSelect}
                ref={fileInputRef}
                hidden
              />
              <button className="btn-file" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />
                <span>选择文件</span>
              </button>
              <span className="panel-hint">支持 GitHub Flavored Markdown</span>
            </div>
          </div>
          <textarea
            className="markdown-editor"
            value={markdown}
            onChange={handleMarkdownChange}
            placeholder="在此输入 Markdown 内容，或点击「选择文件」导入 .md 文件..."
            spellCheck={false}
          />
        </div>

        {/* 右侧：预览 */}
        <div className={`preview-panel ${activeTab === 'preview' ? 'active' : ''}`}>
          {/* 手机预览区域 */}
          <div className="preview-container">
            <div className="wechat-preview">
              {/* iPhone 手机框架 */}
              <div className="phone-mockup">
                <div className="phone-screen">
                  {/* 状态栏 */}
                  <div className="status-bar">
                    <span className="time">9:41</span>
                    <div className="icons">
                      <span>📶</span>
                      <span>📡</span>
                      <span>🔋</span>
                    </div>
                  </div>

                  {/* 微信导航栏 */}
                  <div className="wechat-nav">
                    <div className="back">
                      <span>微信</span>
                    </div>
                    <div className="title">公众号文章</div>
                    <div className="menu">
                      <span style={{fontSize: '18px', letterSpacing: '2px'}}>···</span>
                    </div>
                  </div>

                  {/* 文章滚动区域 */}
                  <div className="article-scroll">
                    <article className="wechat-article">
                      {/* 文章内容 */}
                      <div className="article-content" ref={contentRef}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw, rehypeSanitize]}
                          components={{
                            h1: ({children}) => <h1 className="wx-h1">{children}</h1>,
                            h2: ({children}) => <h2 className="wx-h2">{children}</h2>,
                            h3: ({children}) => <h3 className="wx-h3">{children}</h3>,
                            p: ({children}) => <p className="wx-p">{children}</p>,
                            blockquote: ({children}) => (
                              <blockquote className="wx-blockquote">{children}</blockquote>
                            ),
                            code: ({children, className}) => {
                              const isInline = !className
                              if (isInline) {
                                return <code className="wx-code-inline">{children}</code>
                              }
                              // 代码块：添加行号和日志高亮
                              const codeString = String(children)
                              const lines = codeString.split('\n')
                              const highlightedLines = lines.map((line, index) => {
                                // 检测日志类型并添加颜色
                                let lineClass = ''
                                if (line.includes('成功')) lineClass = 'log-success'
                                else if (line.includes('收到') || line.includes('接收')) lineClass = 'log-receive'
                                else if (line.includes('错误') || line.includes('失败') || line.includes('error') || line.includes('fail')) lineClass = 'log-error'
                                else if (line.includes('警告') || line.includes('warn')) lineClass = 'log-warn'
                                else if (line.includes('发送') || line.includes('输出') || line.includes('输出')) lineClass = 'log-send'
                                return (
                                  <span key={index} className={lineClass}>
                                    {line || ' '}
                                  </span>
                                )
                              })
                              return (
                                <pre className="wx-pre">
                                  <code className="wx-code">{highlightedLines}</code>
                                </pre>
                              )
                            },
                            ul: ({children}) => <ul className="wx-ul">{children}</ul>,
                            ol: ({children}) => <ol className="wx-ol">{children}</ol>,
                            li: ({children}) => <li className="wx-li">{children}</li>,
                            table: ({children}) => (
                              <div className="wx-table-wrapper">
                                <table className="wx-table">{children}</table>
                              </div>
                            ),
                            hr: () => <hr className="wx-hr" />,
                            a: ({children, href}) => (
                              <a className="wx-a" href={href} target="_blank" rel="noopener noreferrer">
                                {children}
                              </a>
                            ),
                            img: ({src, alt}) => <img className="wx-img" src={src} alt={alt || ''} />,
                          }}
                        >
                          {markdown}
                        </ReactMarkdown>
                      </div>

                      {/* 底部操作 */}
                      <div className="article-actions">
                        <span className="read-more-link">阅读原文</span>
                        <span className="like-btn">
                          <span>👍</span>
                          <span>喜欢</span>
                        </span>
                      </div>

                      {/* 安全区域 */}
                      <div className="safe-area"></div>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* HTML 预览弹窗 */}
      {showHtmlModal && (
        <div className="modal-overlay" onClick={() => setShowHtmlModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>公众号 HTML 代码</h3>
              <button className="modal-close" onClick={() => setShowHtmlModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <textarea 
                className="html-code" 
                value={generateWechatHtml()}
                readOnly
                onClick={(e) => e.currentTarget.select()}
              />
              <p className="modal-hint">
                💡 提示：点击代码区域全选，然后 Ctrl+C 复制，粘贴到公众号编辑器
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowHtmlModal(false)}>
                关闭
              </button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  handleCopyHtml()
                  setShowHtmlModal(false)
                }}
              >
                <Copy size={16} />
                <span>复制并关闭</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
