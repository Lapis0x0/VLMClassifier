#!/bin/bash

# 设置npm镜像源为淘宝镜像，避免网络问题
echo "设置npm镜像源为淘宝镜像..."
npm config set registry https://registry.npmmirror.com

# 安装依赖
echo "安装Node.js后端依赖..."
npm install

echo "Node.js后端依赖安装完成！"
