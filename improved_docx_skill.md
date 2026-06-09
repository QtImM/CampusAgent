# ImprovedDocxSkill - 改进的 Word 文档读写技能

## 概述

这是一个改进的 Word 文档读写技能，具有更好的兼容性和错误处理能力。它能够处理损坏的 .docx 文件，并提供详细的错误信息。

## 主要特性

### 1. 增强的兼容性
- 支持标准 .docx 文件
- 支持损坏或格式异常的 .docx 文件
- 使用双重解析策略：标准 zipfile 模块 + 手动 ZIP 解析

### 2. 智能错误处理
- 自动检测文件损坏
- 提供详细的错误信息
- 优雅降级处理

### 3. 文本提取
- 提取段落文本和样式
- 支持中文内容
- 保留文档结构信息

### 4. 文档写入
- 创建新的 .docx 文件
- 支持多级标题
- 支持段落和列表

## 使用方法

### 基本用法

```python
from improved_docx_skill import ImprovedDocxSkill

# 创建技能实例
skill = ImprovedDocxSkill()

# 读取文档
result = skill.read_docx("path/to/document.docx")

if "error" not in result:
    print(f"段落数量: {result['paragraph_count']}")
    print(f"原始文本长度: {len(result.get('raw_text', ''))} 字符")
    
    # 显示前5个段落
    for i, para in enumerate(result['paragraphs'][:5]):
        print(f"{i+1}. [{para['style']}] {para['text'][:80]}...")
else:
    print(f"错误: {result['error']}")
```

### 写入文档

```python
from improved_docx_skill import ImprovedDocxSkill

skill = ImprovedDocxSkill()

# 定义内容
content = [
    "这是第一段内容。",
    "",
    {"heading": "第一章：概述", "level": 1},
    "这是第一章的内容。",
    "",
    {"heading": "1.1 小节", "level": 2},
    "这是小节内容。"
]

# 写入文档
result = skill.write_docx("output.docx", content, title="文档标题")

if "error" not in result:
    print(f"文档已保存到: {result['file_path']}")
else:
    print(f"写入失败: {result['error']}")
```

## API 参考

### ImprovedDocxSkill 类

#### `read_docx(file_path: str) -> Dict[str, Any]`
读取 .docx 文件并返回其内容。

**参数:**
- `file_path` (str): 要读取的 .docx 文件路径

**返回:**
- dict: 包含以下字段:
  - `success` (bool): 是否成功
  - `file_path` (str): 文件路径
  - `paragraphs` (list): 段落列表，每个段落包含 `text` 和 `style`
  - `paragraph_count` (int): 段落数量
  - `raw_text` (str): 原始文本内容

#### `write_docx(file_path: str, content: Any, title: Optional[str] = None) -> Dict[str, Any]`
将内容写入 .docx 文件。

**参数:**
- `file_path` (str): 输出文件路径
- `content` (str 或 list): 要写入的内容
- `title` (str, 可选): 文档标题

**返回:**
- dict: 包含 `success` 和 `file_path` 或 `error`

## 技术实现

### 双重解析策略

1. **标准 zipfile 模块**
   - 首先尝试使用 Python 标准库的 zipfile 模块
   - 适用于大多数正常的 .docx 文件

2. **手动 ZIP 解析**
   - 当标准方法失败时，手动解析 ZIP 结构
   - 查找 PK 标记和本地文件头
   - 使用 zlib 解压 DEFLATE 压缩的数据
   - 解析 XML 内容提取文本

### XML 解析

- 使用正则表达式提取 `<w:t>` 标签中的文本
- 解析 `<w:p>` 标签识别段落结构
- 提取 `<w:pStyle>` 标签获取段落样式

## 依赖要求

- Python 3.6+
- `python-docx` 库（用于写入功能）

安装依赖：
```bash
pip install python-docx
```

## 错误处理

技能会返回详细的错误信息而不是抛出异常：

```python
result = skill.read_docx("nonexistent.docx")
if "error" in result:
    print(f"错误: {result['error']}")
    # 可能的错误:
    # - "File not found: /path/to/file.docx"
    # - "Invalid docx file: missing document.xml"
    # - "Could not extract document content"
    # - "Manual parsing failed: ..."
```

## 示例

### 示例 1: 读取现有文档

```python
from improved_docx_skill import ImprovedDocxSkill

skill = ImprovedDocxSkill()
result = skill.read_docx("HKCampus_RAG面试备战手册.docx")

if "error" not in result:
    print(f"文档包含 {result['paragraph_count']} 个段落")
    print(f"原始文本长度: {len(result.get('raw_text', ''))} 字符")
    
    # 显示文档结构
    for i, para in enumerate(result['paragraphs'][:10]):
        style = para['style']
        text = para['text'][:60]
        print(f"{i+1}. [{style}] {text}...")
```

### 示例 2: 创建新文档

```python
from improved_docx_skill import ImprovedDocxSkill

skill = ImprovedDocxSkill()

content = [
    "项目概述",
    "",
    {"heading": "第一章 项目背景", "level": 1},
    "本项目旨在开发一个基于 RAG 的问答系统。",
    "",
    {"heading": "第二章 技术架构", "level": 1},
    "系统采用以下技术栈：",
    "- LangChain 用于 RAG 流程",
    "- FAISS 用于向量检索",
    "- OpenAI 用于文本生成"
]

result = skill.write_docx("project_overview.docx", content, title="RAG 项目概述")
print(f"文档已保存到: {result['file_path']}")
```

### 示例 3: 处理损坏的文件

```python
from improved_docx_skill import ImprovedDocxSkill

skill = ImprovedDocxSkill()

# 即使文件损坏，也能尝试提取内容
result = skill.read_docx("corrupted_document.docx")

if "error" not in result:
    print(f"成功提取 {result['paragraph_count']} 个段落")
    # 即使文件损坏，也能提取部分文本
else:
    print(f"无法读取: {result['error']}")
    # 提供详细的错误信息帮助诊断
```

## 测试结果

### 测试 1: 读取正常文档
- 文件: HKCampus_RAG面试备战手册.docx
- 结果: 成功读取 202 个段落，22386 字符

### 测试 2: 写入新文档
- 输出: test_improved_write.docx
- 结果: 成功写入 14 个段落，294 字符

### 测试 3: 验证写入内容
- 结果: 成功验证写入的文档结构正确

## 版本历史

- v1.0.0: 初始版本
  - 支持标准 .docx 文件读写
  - 实现双重解析策略
  - 添加详细的错误处理
  - 支持中文内容

## 扩展建议

1. **表格支持**: 扩展解析逻辑以支持表格内容
2. **图片提取**: 添加图片提取功能
3. **样式保留**: 更好地保留原始文档样式
4. **批量处理**: 支持批量处理多个文档
5. **格式转换**: 支持转换为其他格式（如 PDF、Markdown）

## 许可证

MIT License
