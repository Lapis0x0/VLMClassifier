#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
打包脚本 - 将VLMClassifier项目打包成独立的可执行程序
使用PyInstaller进行打包
"""

import os
import sys
import platform
import PyInstaller.__main__

def build_app():
    """使用PyInstaller打包应用"""
    # 确保当前工作目录是项目根目录
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)
    
    # 创建打包所需的目录结构
    print("确保目录结构存在...")
    if not os.path.exists('dist'):
        os.makedirs('dist')
    
    # 创建图像目录结构 - 程序运行时会自动创建，这只是为了打包过程
    images_dir = os.path.join(project_root, 'images')
    if not os.path.exists(images_dir):
        os.makedirs(images_dir)
    
    # 设置PyInstaller参数
    args = [
        'gui.py',                      # 主脚本
        '--name=VLMClassifier',        # 输出文件名
        '--onefile',                   # 打包成单个文件
        '--windowed',                  # 不显示控制台窗口
        '--icon=images/icon.ico' if os.path.exists('images/icon.ico') else None,  # 应用图标
        '--add-data=README.md:.',      # 添加README文件
        f'--distpath={os.path.join(project_root, "dist")}',  # 输出目录
        '--noconfirm',                 # 不要求确认，覆盖已存在的输出
        '--clean',                     # 清理临时文件
        '--exclude=.env',              # 明确排除.env文件
    ]
    
    # 移除None的项
    args = [arg for arg in args if arg is not None]
    
    # 根据操作系统设置特定参数
    if platform.system() == 'Darwin':  # macOS
        # 使用当前系统的原生架构，而不是universal2
        args.append('--codesign-identity=')  # 自动使用默认的签名身份
    
    print(f"正在使用PyInstaller打包VLMClassifier...")
    
    # 执行PyInstaller
    PyInstaller.__main__.run(args)
    
    print(f"打包完成！")
    print(f"可执行文件位于: {os.path.join(project_root, 'dist', 'VLMClassifier')}")

if __name__ == "__main__":
    build_app()
