# VLM Image Classifier

这是一个使用视觉语言模型(VLM)对图片进行自动分类的Python程序。该程序通过调用VLM API来分析图片内容并进行分类，提供了直观的图形用户界面(GUI)，方便用户操作。

## 功能特点

- 使用VLM API自动分析图片内容并进行分类
- 现代化的图形用户界面，简单易用
- 支持拖放图片和文件夹进行批量处理
- 支持增删图片，灵活管理待分类内容
- 实时显示分类进度条，清晰了解处理状态
- 自动创建分类目录并整理图片
- 支持多种图片格式 (jpg, jpeg, png, gif, bmp)
- 支持自定义API配置和模型参数

## 项目结构

```
VLMClassifier/
├── images/
│   ├── input/     # 存放待分类的图片
│   └── output/    # 存放分类结果
├── image_classifier.py  # 核心分类逻辑
├── gui.py              # 图形用户界面
├── requirements.txt    # 项目依赖
├── .env                # 环境配置
└── README.md           # 项目文档
```

## 安装要求

1. 安装Python 3.7+
2. 安装所需依赖：
```bash
pip install -r requirements.txt
```

## 配置

1. 复制配置文件模板：
```bash
cp .env.example .env
```

2. 编辑.env文件，配置以下参数：

```ini
# API Configuration
API_BASE_URL=your_api_base_url
API_KEY=your_api_key

# Model Configuration
MODEL_NAME=your_model_name

# Directory Configuration
INPUT_DIR=images/input
OUTPUT_DIR=images/output

# Optional: Custom prompt
CLASSIFICATION_PROMPT=your_custom_prompt
```

配置说明：
- API_BASE_URL: API的基础URL
- API_KEY: API访问密钥
- MODEL_NAME: 要使用的模型名称（默认：qwen-vl-plus）
- INPUT_DIR: 待分类图片的目录路径
- OUTPUT_DIR: 分类结果的输出目录路径
- CLASSIFICATION_PROMPT: 自定义的分类提示词（可选）

## 使用方法

### 下载预构建版本（推荐）

1. 访问[GitHub Releases页面](https://github.com/Lapis0x0/VLMClassifier/releases)下载最新版本
2. 根据您的操作系统选择相应的安装包：
   - macOS用户：下载`VLMClassifier.dmg`文件，双击打开，然后将应用拖到Applications文件夹
   - Windows用户：下载`VLMClassifier-vX.X.X-win64.exe`文件，双击运行
3. 首次运行时，您需要在配置面板中输入您的API配置信息

### 命令行模式（开发者）

1. 将需要分类的图片放入 `images/input` 目录

2. 运行命令行程序：
```bash
python image_classifier.py
```

3. 程序会自动处理 `images/input` 目录中的所有图片，并将分类结果保存到 `images/output` 目录中的对应子文件夹。

### 图形界面模式（从源码运行）

1. 运行GUI程序：
```bash
python gui.py
```

2. 在图形界面中操作：
   - 点击"选择图片"按钮或直接拖放图片/文件夹到界面中
   - 可以通过图片右上角的"✕"按钮删除单个图片，或使用"清空全部"按钮删除所有图片
   - 点击"开始分类"按钮开始处理
   - 通过进度条查看处理进度
   - 分类完成后，点击"打开分类结果"查看分类后的图片

## 注意事项

- 需要有有效的API访问密钥
- 使用API时会产生相应的费用，请参考相关的计费规则
- 处理大量图片时可能需要较长时间，请耐心等待
- 在命令行模式下，确保 `images/input` 目录中只包含图片文件
- 出于安全考虑，应用不会保存您的API密钥到任何可能被分享的文件中
- 应用会安全地将您的API配置保存在本地，无需每次启动时重新输入
- 打包版本的发布过程采用了特殊处理，确保开发者的API密钥不会被包含在发布版本中

## 开发路线图

### 1.0版本
- [X] 核心分类功能
- [X] 基本GUI界面
- [X] 拖放支持
- [X] 图片管理（增删）
- [X] 分类进度显示

### 1.1版本
- [X] 在GUI中选择和配置模型
- [X] 在GUI中自定义分类提示词
- [X] 保存和加载分类配置

### 2.0版本（当前）
- [X] 打包为独立可执行程序（目前已完成macOS和Windows的打包）
- [X] 使用GitHub Actions自动构建发布版本
- [X] 增强安全性，确保API密钥不会在打包版本中泄露
- [] 支持更多图片格式
- [] 给项目设计一个图标

### 未来可能计划
- [] 多语言支持
- [] 本地模型支持，无需联网
- [] 自定义分类规则和过滤器
- [] 图片编辑基本功能
- [] 云同步和备份
- [] 移动端支持
- [] 批量重命名功能

## 贡献指南

欢迎对本项目提出建议或贡献代码。如果您想参与开发，请遵循以下步骤：

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请参见 LICENSE 文件
