# VLM Image Classifier

这是一个使用视觉语言模型(VLM)对图片进行自动分类的Python程序。该程序通过调用VLM API来分析图片内容并进行分类。

## 功能特点

- 使用VLM API自动分析图片内容并进行分类
- 支持批量处理整个目录的图片
- 自动创建分类目录并整理图片
- 支持多种图片格式 (jpg, jpeg, png, gif, bmp)
- 支持自定义API配置和模型参数

## 项目结构

```
VLMClassifier/
├── images/
│   ├── input/     # 存放待分类的图片
│   └── output/    # 存放分类结果
├── image_classifier.py
├── requirements.txt
├── .env
└── README.md
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

1. 将需要分类的图片放入 `images/input` 目录

2. 运行程序：
```bash
python image_classifier.py
```

3. 程序会自动处理 `images/input` 目录中的所有图片，并将分类结果保存到 `images/output` 目录中的对应子文件夹。

## 注意事项

- 需要有有效的API访问密钥
- 使用API时会产生相应的费用，请参考相关的计费规则
- 处理大量图片时可能需要较长时间，请耐心等待
- 确保 `images/input` 目录中只包含图片文件
