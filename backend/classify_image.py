#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import base64
from pathlib import Path
from PIL import Image
from io import BytesIO
import argparse

# 尝试导入OpenAI库
try:
    from openai import OpenAI
except ImportError:
    print("错误: 未安装OpenAI库，请运行 pip install openai", file=sys.stderr)
    sys.exit(1)

# 尝试导入dotenv库
try:
    from dotenv import load_dotenv
except ImportError:
    print("错误: 未安装python-dotenv库，请运行 pip install python-dotenv", file=sys.stderr)
    sys.exit(1)

# 加载环境变量
try:
    # 尝试从当前目录加载.env
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        print(f"从{env_path}加载环境变量")
        load_dotenv(dotenv_path=env_path)
    else:
        print(f"警告: .env文件不存在: {env_path}")
        # 尝试从其他位置加载
        parent_env = Path(__file__).parent.parent / '.env'
        if parent_env.exists():
            print(f"从{parent_env}加载环境变量")
            load_dotenv(dotenv_path=parent_env)
        else:
            print(f"警告: 父目录中也没有.env文件: {parent_env}")
            # 使用默认加载方式
            load_dotenv()
finally:
    # 打印环境变量状态（不打印实际值）
    print(f"API_KEY: {'已设置' if os.getenv('API_KEY') else '未设置'}")
    print(f"API_BASE_URL: {'已设置' if os.getenv('API_BASE_URL') else '未设置'}")
    print(f"MODEL_NAME: {os.getenv('MODEL_NAME', DEFAULT_MODEL)}")
    print(f"CLASSIFICATION_PROMPT: {'已设置' if os.getenv('CLASSIFICATION_PROMPT') else '使用默认值'}")

# 默认配置
DEFAULT_MODEL = "qwen-vl-plus-latest"
DEFAULT_PROMPT = "请分析这张图片属于哪个类别：二次元、生活照片、宠物、工作、表情包。只需回答类别名称，不要解释。"
VALID_CATEGORIES = ['二次元', '生活照片', '宠物', '工作', '表情包', '其他']

def preprocess_image(image_path, max_size=(1024, 1024), quality=85):
    """预处理图片：调整大小和压缩"""
    try:
        # 打开图片
        with Image.open(image_path) as img:
            # 转换为RGB模式（去除透明通道）
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
                img = background
            
            # 调整大小
            img.thumbnail(max_size, Image.LANCZOS)
            
            # 将图片转换为base64编码
            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=quality)
            buffer.seek(0)
            
            # 返回base64编码的图片数据
            return base64.b64encode(buffer.read()).decode('utf-8')
    except Exception as e:
        print(f"图片预处理失败: {str(e)}", file=sys.stderr)
        sys.exit(1)

def get_closest_category(response_text):
    """获取最接近的预定义类别"""
    response_text = response_text.strip().lower()
    
    # 直接匹配
    for category in VALID_CATEGORIES:
        if category.lower() in response_text:
            return category
    
    # 如果没有直接匹配，返回"其他"
    return "其他"

def classify_image(image_path):
    """使用VLM对图片进行分类"""
    try:
        print(f"开始分类图片: {image_path}")
        
        # 检查图片文件是否存在
        if not os.path.exists(image_path):
            print(f"错误: 图片文件不存在: {image_path}", file=sys.stderr)
            sys.exit(1)
        else:
            print(f"图片文件存在: {image_path}")
            # 获取文件大小
            file_size = os.path.getsize(image_path)
            print(f"图片文件大小: {file_size} 字节")
        
        # 检查API密钥和基础URL
        api_key = os.getenv('API_KEY')
        api_base_url = os.getenv('API_BASE_URL')
        model_name = os.getenv('MODEL_NAME', DEFAULT_MODEL)
        prompt = os.getenv('CLASSIFICATION_PROMPT', DEFAULT_PROMPT)
        
        print(f"使用模型: {model_name}")
        print(f"分类提示词: {prompt}")
        
        if not api_key:
            print("错误: 未设置API_KEY环境变量", file=sys.stderr)
            sys.exit(1)
        
        if not api_base_url:
            print("错误: 未设置API_BASE_URL环境变量", file=sys.stderr)
            sys.exit(1)
        
        # 预处理图片
        print("开始预处理图片...")
        base64_image = preprocess_image(image_path)
        print("图片预处理完成")
        
        # 初始OpenAI客户端
        print("初始OpenAI客户端...")
        client = OpenAI(
            api_key=api_key,
            base_url=api_base_url
        )
        print("客户端初始化完成")
        
        # 发送请求
        print("发送API请求...")
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=100
        )
        print("收到API响应")
        
        # 解析响应
        original_response = response.choices[0].message.content
        category = get_closest_category(original_response)
        
        # 构建结果
        result = {
            "category": category,
            "confidence": 1.0,  # 简化处理，设置为固定值
            "original_response": original_response
        }
        
        # 输出JSON结果
        print(json.dumps(result, ensure_ascii=False))
        return 0
        
    except Exception as e:
        print(f"分类失败: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # 打印脚本信息
    print(f"脚本路径: {__file__}")
    print(f"当前工作目录: {os.getcwd()}")
    print(f"脚本目录: {os.path.dirname(os.path.abspath(__file__))}")
    print(f"Python版本: {sys.version}")
    
    parser = argparse.ArgumentParser(description="使用视觉语言模型对图片进行分类")
    parser.add_argument("image_path", help="要分类的图片路径")
    args = parser.parse_args()
    
    # 检查命令行参数
    print(f"命令行参数: {sys.argv}")
    print(f"图片路径: {args.image_path}")
    
    try:
        exit_code = classify_image(args.image_path)
        print(f"脚本执行完成，退出码: {exit_code}")
        sys.exit(exit_code)
    except Exception as e:
        print(f"脚本执行失败: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
