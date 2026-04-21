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
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
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

\`\`\`go
func pyramidTransition(bottom string, allowed []string) bool {
    rules := make(map[string][]byte)
    for _, s := range allowed {
        key := s[:2]
        rules[key] = append(rules[key], s[2])
    }

    memo := make(map[string]bool)
    // ...
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
      'wx-code-inline': 'font-family: "SF Mono", "JetBrains Mono", monospace; font-size: 0.85em; padding: 2px 6px; background: #f1f3f4; border-radius: 4px; color: #d73a49; font-weight: 500;',
      
      // 代码块 - macOS 终端风格
      'wx-code-window': 'margin: 16px 0; background: #1e1e2e; border-radius: 10px; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.3); border: 1px solid #2a2a3c;',

      'wx-code-header': 'height: 36px; background:rgb(58, 58, 71); display: flex; align-items: center; padding: 0 14px; gap: 8px; border-bottom: 1px solid #2a2a3c; position: relative;',

      'wx-code-dot-red': 'width: 10px; height: 10px; border-radius: 50%; display: inline-block; background: #ff5f56; box-shadow: inset 0 0 0 0.5px rgba(0,0,0,0.1); color: transparent; font-size: 0; line-height: 0; margin-right: 8px;',

      'wx-code-dot-yellow': 'width: 10px; height: 10px; border-radius: 50%; display: inline-block; background: #ffbd2e; box-shadow: inset 0 0 0 0.5px rgba(0,0,0,0.1); color: transparent; font-size: 0; line-height: 0; margin-right: 8px;',

      'wx-code-dot-green': 'width: 10px; height: 10px; border-radius: 50%; display: inline-block; background: #27c93f; box-shadow: inset 0 0 0 0.5px rgba(0,0,0,0.1); color: transparent; font-size: 0; line-height: 0;',

      'wx-code-lang': 'margin-left: auto; float: right; margin-right: 14px; margin-top: 10px; font-size: 11px; color: #6b6b7b; font-family: "SF Mono", "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: 0.5px;',

      'wx-code-body': 'background: #1e1e2e; overflow-x: auto; -webkit-overflow-scrolling: touch;',

      // 导出用纯文本代码块样式（扁平化 SyntaxHighlighter 的复杂 span）
      'wx-export-pre': 'margin: 0; padding: 16px; background: transparent; font-size: 14px; line-height: 1.6; border-radius: 0 0 10px 10px; white-space: nowrap; word-wrap: normal; word-break: keep-all; overflow-x: auto; -webkit-overflow-scrolling: touch; color: #abb2bf; font-family: "SF Mono", "JetBrains Mono", "Fira Code", monospace;',

      'wx-export-code': 'font-family: "SF Mono", "JetBrains Mono", "Fira Code", monospace; background: transparent; display: block;',

      // 保留旧的代码块样式
      'wx-pre': 'margin: 16px 0; background: #f8f9fa; border-radius: 8px; overflow-x: auto; border: 1px solid #e9ecef; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);',

      'wx-code': 'font-family: "SF Mono", "JetBrains Mono", "Fira Code", monospace; font-size: 14px; line-height: 1.6; color: #24292e; background: transparent; padding: 16px; display: block; white-space: pre; word-wrap: normal; overflow-x: auto;',

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

    // 在 class 转换之前：简化 SyntaxHighlighter 生成的复杂 span 结构
    // 保留颜色信息，去掉不必要的嵌套，提高微信公众号编辑器兼容性
    styledHtml = styledHtml.replace(
      /<div[^>]*\bclass="wx-code-body"[^>]*>([\s\S]*?)<\/div>/g,
      (_, inner) => {
        // 1. 去掉外层 pre/code 标签（后面会重新包装）
        let processed = inner
          .replace(/<pre[^>]*>/g, '')
          .replace(/<\/pre>/g, '')
          .replace(/<code[^>]*>/g, '')
          .replace(/<\/code>/g, '')

        // 2. 保留带 style 的 span，只提取 color 属性（防止 style 中的双引号冲突）
        // 没有 style 的 span 也要保留（可能是空格 token）
        processed = processed.replace(
          /<span\b[^>]*>/g,
          (match: string) => {
            const styleMatch = match.match(/style="([^"]*)"/)
            if (styleMatch) {
              const colorMatch = styleMatch[1].match(/color:\s*([^;]+)/i)
              if (colorMatch) {
                const safeColor = colorMatch[1].trim().replace(/"/g, "'")
                return `<span style='color:${safeColor}'>`
              }
            }
            // 保留原始 span（空格 token 等无 style 的 span）
            return match
          }
        )

        // 3. 去掉所有其他标签（保留 span、/span）
        processed = processed.replace(/<(?!span\b|\/span>)[^>]*>/g, '')

        // 4. 处理空白：把换行符转为 <br>，空格转为 &nbsp;
        // 注意：不要去掉标签之间的换行，因为 SyntaxHighlighter 的 innerHTML 中
        // 标签之间的 \n 是代码的实际换行，不是浏览器插入的格式化空白
        processed = processed.replace(/\n/g, '<br>')
        // 把所有普通空格转为 &nbsp;，防止微信编辑器合并空格
        processed = processed.replace(/ /g, '&nbsp;')

        return `<div class="wx-code-body"><pre class="wx-export-pre"><code class="wx-export-code">${processed}</code></pre></div>`
      }
    )

    // 转换所有 class 为内联样式
    // 按 class name 长度降序排序，确保先处理长的（如 wx-code-inline 在 wx-code 之前）
    const sortedEntries = Object.entries(styleMap).sort((a, b) => b[0].length - a[0].length)
    
    sortedEntries.forEach(([className, style]) => {
      // 使用正则确保匹配完整的 class name（避免 wx-code 匹配到 wx-code-inline）
      const regex = new RegExp(`class="${className}"`, 'g')
      // 将 style 中的双引号替换为单引号，避免与 HTML 属性的双引号冲突
      const safeStyle = style.replace(/"/g, "'")
      styledHtml = styledHtml.replace(regex, `style="${safeStyle}"`)
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
      const textBlob = new Blob([html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')], { type: 'text/plain' })
      
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
                          rehypePlugins={[]}
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
                              const language = className.replace('language-', '') || 'text'
                              return (
                                <div className="wx-code-window">
                                  <div className="wx-code-header">
                                    <span className="wx-code-dot-red">&nbsp;</span>
                                    <span className="wx-code-dot-yellow">&nbsp;</span>
                                    <span className="wx-code-dot-green">&nbsp;</span>
                                    <span className="wx-code-lang">{language}</span>
                                  </div>
                                  <div className="wx-code-body">
                                    <SyntaxHighlighter
                                      language={language}
                                      style={vscDarkPlus}
                                      useInlineStyles={true}
                                      customStyle={{
                                        margin: 0,
                                        padding: '16px',
                                        background: 'transparent',
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        borderRadius: '0 0 10px 10px',
                                        whiteSpace: 'pre',
                                        overflow: 'auto',
                                        WebkitOverflowScrolling: 'touch',
                                      }}
                                      codeTagProps={{
                                        style: {
                                          background: 'transparent',
                                          fontFamily: '"SF Mono", "JetBrains Mono", "Fira Code", monospace',
                                        }
                                      }}
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  </div>
                                </div>
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
