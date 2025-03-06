#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
打包脚本 - 将VLMClassifier项目打包成独立的可执行程序
使用PyInstaller进行打包
"""

import os
import sys
import platform
import io
import locale
import shutil
import subprocess

# 设置标准输出编码为UTF-8，解决Windows环境下的编码问题
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def build_app():
    """使用PyInstaller打包应用"""
    # 确保当前工作目录是项目根目录
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)
    
    # 创建打包所需的目录结构
    print("Creating directory structure...")
    if not os.path.exists('dist'):
        os.makedirs('dist')
    
    # 创建图像目录结构 - 程序运行时会自动创建，这只是为了打包过程
    images_dir = os.path.join(project_root, 'images')
    if not os.path.exists(images_dir):
        os.makedirs(images_dir)
    
    # 清理之前的构建文件
    build_dir = os.path.join(project_root, 'build')
    if os.path.exists(build_dir):
        print("Cleaning previous build files...")
        shutil.rmtree(build_dir, ignore_errors=True)
    
    dist_dir = os.path.join(project_root, 'dist')
    if os.path.exists(dist_dir):
        print("Cleaning previous dist files...")
        shutil.rmtree(dist_dir, ignore_errors=True)
        os.makedirs(dist_dir)
    
    # 生成spec文件
    print("Generating spec file...")
    spec_command = [
        sys.executable, '-m', 'PyInstaller',
        '--name=VLMClassifier',
        '--windowed' if platform.system() != 'Darwin' else '--noconsole',
        '--add-data=README.md:.',
        '--exclude-module=.env',
        '--noupx',
        '--specpath', project_root,
        'gui.py'
    ]
    
    if platform.system() == 'Darwin':
        spec_command.extend([
            '--osx-bundle-identifier=com.lapis0x0.vlmclassifier',
            '--codesign-identity='
        ])
    else:
        spec_command.append('--onefile')
    
    if os.path.exists('images/icon.ico'):
        spec_command.append('--icon=images/icon.ico')
    
    # 执行命令生成spec文件
    subprocess.run(spec_command, check=True)
    
    # 修改spec文件以解决PyQt5符号链接问题
    spec_file = os.path.join(project_root, 'VLMClassifier.spec')
    with open(spec_file, 'r', encoding='utf-8') as f:
        spec_content = f.read()
    
    # 添加收集PyQt5和openai模块的代码
    if 'hiddenimports=[]' in spec_content:
        spec_content = spec_content.replace(
            'hiddenimports=[]',
            'hiddenimports=["PyQt5", "PyQt5.QtCore", "PyQt5.QtGui", "PyQt5.QtWidgets", "openai"]'
        )
    
    # 写回修改后的spec文件
    with open(spec_file, 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    # 使用修改后的spec文件构建应用
    print("Building application using modified spec file...")
    build_command = [
        sys.executable, '-m', 'PyInstaller',
        '--clean',
        '--noconfirm',
        spec_file
    ]
    
    subprocess.run(build_command, check=True)
    
    print("Build completed successfully!")
    
    # 如果是macOS，添加额外的清理步骤
    if platform.system() == 'Darwin':
        app_path = os.path.join(dist_dir, 'VLMClassifier.app')
        if os.path.exists(app_path):
            print("Finalizing macOS application bundle...")
            # 删除可能导致闪退的文件
            problematic_dirs = [
                os.path.join(app_path, 'Contents/MacOS/_internal/PyQt5/Qt5/plugins/platforminputcontexts'),
                os.path.join(app_path, 'Contents/MacOS/_internal/PyQt5/Qt5/plugins/platformthemes')
            ]
            
            for dir_path in problematic_dirs:
                if os.path.exists(dir_path):
                    print(f"Removing problematic directory: {dir_path}")
                    shutil.rmtree(dir_path, ignore_errors=True)
    
    print(f"Build completed!")
    print(f"Executable located at: {os.path.join(project_root, 'dist', 'VLMClassifier')}")

if __name__ == "__main__":
    build_app()
