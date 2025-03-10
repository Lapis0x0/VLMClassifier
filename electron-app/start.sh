#!/bin/bash

# VLMClassifier Electron应用启动脚本

# 设置颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # 无颜色

echo -e "${BLUE}=== VLMClassifier Electron应用启动脚本 ===${NC}"

# 检查是否在开发模式下运行
DEV_MODE=0
if [ "$1" == "--dev" ]; then
  DEV_MODE=1
  echo -e "${GREEN}以开发模式启动应用${NC}"
else
  echo -e "${GREEN}以生产模式启动应用${NC}"
fi

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
ELECTRON_DIR="$PROJECT_ROOT/electron-app"

echo -e "${BLUE}项目根目录: $PROJECT_ROOT${NC}"

# 检查后端是否已经在运行
check_backend() {
  echo -e "${BLUE}检查后端服务是否已启动...${NC}"
  if curl -s http://localhost:8001/ > /dev/null; then
    echo -e "${GREEN}后端服务已在运行${NC}"
    return 0
  else
    echo -e "${BLUE}后端服务未启动${NC}"
    return 1
  fi
}

# 启动后端服务
start_backend() {
  echo -e "${BLUE}启动后端服务...${NC}"
  cd "$BACKEND_DIR" || exit
  
  # 检查是否有虚拟环境
  if [ -d ".venv" ]; then
    echo -e "${BLUE}使用虚拟环境${NC}"
    source .venv/bin/activate
  fi
  
  # 启动后端服务
  python main.py &
  BACKEND_PID=$!
  echo -e "${GREEN}后端服务已启动，PID: $BACKEND_PID${NC}"
  
  # 等待后端服务启动
  echo -e "${BLUE}等待后端服务就绪...${NC}"
  for i in {1..30}; do
    if curl -s http://localhost:8001/ > /dev/null; then
      echo -e "${GREEN}后端服务已就绪${NC}"
      return 0
    fi
    echo -n "."
    sleep 1
  done
  
  echo -e "${RED}后端服务启动超时${NC}"
  return 1
}

# 启动Electron应用
start_electron() {
  echo -e "${BLUE}启动Electron应用...${NC}"
  cd "$ELECTRON_DIR" || exit
  
  if [ $DEV_MODE -eq 1 ]; then
    # 开发模式：先启动前端开发服务器
    echo -e "${BLUE}启动前端开发服务器...${NC}"
    cd "$FRONTEND_DIR" || exit
    npm run dev &
    FRONTEND_PID=$!
    echo -e "${GREEN}前端开发服务器已启动，PID: $FRONTEND_PID${NC}"
    
    # 等待前端服务器启动
    echo -e "${BLUE}等待前端服务器就绪...${NC}"
    for i in {1..30}; do
      if curl -s http://localhost:3000/ > /dev/null; then
        echo -e "${GREEN}前端服务器已就绪${NC}"
        break
      fi
      echo -n "."
      sleep 1
    done
    
    # 启动Electron应用（开发模式）
    cd "$ELECTRON_DIR" || exit
    echo -e "${BLUE}以开发模式启动Electron应用...${NC}"
    npm run dev
  else
    # 生产模式：直接启动Electron应用
    echo -e "${BLUE}以生产模式启动Electron应用...${NC}"
    npm start
  fi
}

# 主函数
main() {
  # 检查后端是否已经在运行
  if ! check_backend; then
    # 如果后端未运行，则启动后端
    start_backend
  fi
  
  # 启动Electron应用
  start_electron
}

# 执行主函数
main

# 退出时清理进程
cleanup() {
  echo -e "${BLUE}清理进程...${NC}"
  if [ -n "$BACKEND_PID" ]; then
    echo -e "${BLUE}终止后端服务 (PID: $BACKEND_PID)${NC}"
    kill $BACKEND_PID
  fi
  if [ -n "$FRONTEND_PID" ]; then
    echo -e "${BLUE}终止前端服务器 (PID: $FRONTEND_PID)${NC}"
    kill $FRONTEND_PID
  fi
  echo -e "${GREEN}清理完成${NC}"
}

# 注册退出钩子
trap cleanup EXIT
