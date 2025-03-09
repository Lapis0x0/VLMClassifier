#!/bin/bash

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

# 检查是否存在虚拟环境，如果不存在则创建
if [ ! -d "venv" ]; then
    echo "创建 Python 虚拟环境..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# 启动后端服务
echo "启动 VLM分类器后端服务..."
echo "当前工作目录: $(pwd)"
echo "启动服务在端口 8000..."

# 使用端口8000启动服务
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info
