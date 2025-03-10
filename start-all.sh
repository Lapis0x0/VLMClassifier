#!/bin/bash

# 启动Next.js前端服务器
echo "启动Next.js前端服务器..."
cd frontend
npm run dev &
FRONTEND_PID=$!
echo "前端服务器已启动，PID: $FRONTEND_PID"

# 等待前端服务器启动
echo "等待前端服务器启动..."
sleep 5

# 启动Node.js后端服务器
echo "启动Node.js后端服务器..."
cd ../node-backend
node index.js &
BACKEND_PID=$!
echo "后端服务器已启动，PID: $BACKEND_PID"

# 等待后端服务器启动
echo "等待后端服务器启动..."
sleep 3

# 启动Electron应用
echo "启动Electron应用..."
cd ../electron-app
npm start

# 当Electron应用关闭时，关闭前端和后端服务器
echo "关闭服务器..."
kill $FRONTEND_PID
kill $BACKEND_PID
echo "所有服务已关闭"
