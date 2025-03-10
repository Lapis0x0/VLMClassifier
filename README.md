# VLM Image Classifier-ReNew

这是一个使用视觉语言模型(VLM)对图片进行自动分类的Python程序。该程序通过调用VLM API来分析图片内容并进行分类，使用next.js来重构前端页面

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

VLMClassifier/
├── backend/                # 后端 API 服务
│   ├── main.py            # 主要 API 实现
│   ├── classified/        # 存放分类后的图片
│   ├── uploads/           # 存放上传的图片
│   └── static/            # 静态文件
│
├── frontend/               # 前端 Next.js 应用
│   ├── src/
│   │   ├── app/           # Next.js 应用页面
│   │   └── components/    # React 组件
│   │       ├── ClassificationResults.tsx  # 分类结果展示组件
│   │       ├── ClassifiedGallery.tsx      # 已分类图片库组件
│   │       ├── Header.tsx                 # 页面头部组件
│   │       ├── ImageUploader.tsx          # 图片上传组件
│   │       └── SettingsModal.tsx          # 设置模态框组件
│   └── vlmclassifier-next/ # Next.js 构建输出
│
├── electron-app/           # Electron 桌面应用相关文件
│
├── image_classifier.py     # 原始的图片分类核心逻辑
├── gui.py                  # 原始的图形用户界面
├── build.py                # 构建脚本
│
├── .env                    # 环境配置文件
└── README.md               # 项目文档

### 核心模块解析
后端 API 服务提供以下主要功能：

图片分类：
- 单张图片分类 (/classify)
- 批量图片分类 (/classify-multiple)
图片管理：
- 获取已分类图片列表 (/classified-images)
- 获取图片内容 (/image/{category}/{filename})
- 重新分类图片 (/reclassify)
配置管理：
- 获取配置 (/config)
- 更新配置 (/update-config)
- 获取分类类别 (/categories)
后端使用 OpenAI 客户端调用视觉语言模型 API 进行图片分析和分类。

前端 (Next.js)
前端由以下主要组件构成：

- ImageUploader：处理图片上传功能
- ClassificationResults：显示分类结果
- ClassifiedGallery：展示已分类的图片库
- Header：应用头部导航
SettingsModal：配置设置界面

## 贡献指南

欢迎对本项目提出建议或贡献代码。如果您想参与开发，请遵循以下步骤：

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请参见 LICENSE 文件
