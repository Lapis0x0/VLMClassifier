# VLM Image Classifier-ReNew

这是一个使用视觉语言模型(VLM)对图片进行自动分类的应用程序。该应用通过调用VLM API来分析图片内容并进行智能分类，使用Next.js构建现代化前端界面，提供流畅的用户体验。

## 功能特点

- **智能分类** - 利用先进的视觉语言模型API自动分析图片内容并进行精准分类
- **分类图库** - 支持网格视图和列表视图两种模式，方便浏览已分类图片
- **响应式设计** - 现代化的用户界面，适配各种设备屏幕
- **批量处理** - 支持拖放图片和文件夹进行批量处理，高效处理大量图片
- **灵活管理** - 支持增删图片，重新分类，框选批量操作等功能
- **实时进度** - 显示分类进度条，清晰了解处理状态
- **自动整理** - 自动创建分类目录并整理图片，告别手动分类的繁琐
- **图片预览** - 点击图片可放大查看，显示详细信息
- **分页功能** - 支持设置每页显示的图片数量(10/20/50/100张)，高效浏览大量图片
- **自定义配置** - 支持自定义API配置、模型参数和分类提示词

## 技术栈

- **后端**: Node.js + Express
- **前端**: Next.js + React + Tailwind CSS
- **桌面应用**: Electron
- **图像处理**: Sharp
- **AI模型**: OpenAI Vision API (支持GPT-4 Vision等模型)

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/yourusername/VLMClassifier.git
cd VLMClassifier
```

2. 配置环境变量
```bash
cp .env.example .env
```
编辑`.env`文件，填入你的API密钥和其他配置信息。

3. 启动应用

使用一键启动脚本:
```bash
sh start-all.sh
```

或者分别启动前后端:

后端:
```bash
cd node-backend
npm install
npm start
```

前端:
```bash
cd frontend
npm install
npm run dev
```

4. 访问应用
在浏览器中打开 `http://localhost:3000` 即可使用Web版本。

### 使用Electron桌面应用

```bash
cd electron-app
npm install
npm start
```

## 使用指南

### 上传图片
1. 点击上传区域或将图片拖放到上传区域
2. 支持单张或多张图片上传
3. 支持拖放整个文件夹进行批量上传

### 分类图片
1. 上传图片后，点击"开始分类"按钮
2. 系统将自动调用VLM API分析图片内容并进行分类
3. 分类完成后，图片将自动移动到对应的分类目录中

### 浏览已分类图片
1. 在右侧"已分类图片库"面板中浏览所有已分类的图片
2. 可以按类别筛选图片
3. 支持网格视图和列表视图两种浏览模式
4. 点击图片可查看大图和详细信息

### 重新分类
1. 在图片库中找到需要重新分类的图片
2. 点击图片打开预览
3. 选择目标类别并点击"重新分类"按钮

### 批量操作
1. 在图片库中按住鼠标左键拖动可框选多张图片
2. 框选完成后，可对选中的图片进行批量操作
3. 支持批量重新分类、删除等操作

### 自定义设置
1. 点击顶部导航栏中的"设置"按钮
2. 可以自定义API配置、模型参数和分类提示词
3. 修改设置后点击"保存"按钮使设置生效

## 项目结构
```markdown
VLMClassifier/
├── backend/                # 后端 API 服务
│   ├── main.py            # 主要 API 实现
│   ├── classified/        # 存放分类后的图片
│   ├── uploads/           # 存放上传的图片
│   └── static/            # 静态文件
│
├── node-backend/           # Node.js 后端服务
│   ├── index.js           # Express 服务器和API实现
│   ├── classified/        # 分类后的图片存储目录
│   ├── uploads/           # 上传图片临时存储目录
│   └── static/            # 静态资源文件
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
├── start-all.sh            # 一键启动脚本
│
├── .env                    # 环境配置文件
└── README.md               # 项目文档
```

### 核心模块解析

#### 后端 API 服务
提供以下主要功能：

**图片分类**:
- 单张图片分类 (`/classify`)
- 批量图片分类 (`/classify-multiple`)

**图片管理**:
- 获取已分类图片列表 (`/classified-images`)
- 获取图片内容 (`/image/{category}/{filename}`)
- 重新分类图片 (`/reclassify`)
- 删除图片 (`/delete-image`)

**配置管理**:
- 获取配置 (`/config`)
- 更新配置 (`/update-config`)
- 获取分类类别 (`/categories`)

后端使用 OpenAI 客户端调用视觉语言模型 API 进行图片分析和分类。

#### 前端 (Next.js)
前端由以下主要组件构成：

- **ImageUploader**: 处理图片上传功能，支持拖放和批量上传
- **ClassificationResults**: 显示分类结果和进度
- **ClassifiedGallery**: 展示已分类的图片库，支持分页、多种视图模式和批量操作
- **Header**: 应用头部导航和全局控制
- **SettingsModal**: 配置设置界面，支持自定义API和模型参数

## 性能优化

- 图片上传前进行压缩和尺寸调整，减少API调用成本
- 分页加载大量图片，提高浏览性能
- 批量操作支持，提高工作效率
- 缓存分类结果，减少重复API调用

## 未来计划

- [ ] 支持离线模式，使用本地模型进行图片分类
- [ ] 优化打包后的应用样式，提升性能表现
- [ ] 添加更多自定义分类选项和标签系统
- [ ] 实现图片搜索功能，基于内容和标签
- [ ] 支持更多图片格式和视频分类
- [ ] 自定义图片保存路径
- [ ] 使用GitHub Action自动构建各个平台的应用
- [ ] 添加用户账户系统，支持多用户和云同步

## 常见问题

**Q: 如何更改默认的分类类别?**  
A: 在设置中修改"分类提示词"，自定义你需要的类别。

**Q: 支持哪些图片格式?**  
A: 目前支持jpg、jpeg、png、gif、bmp等常见图片格式。

**Q: 如何提高分类准确率?**  
A: 可以在设置中调整分类提示词，使其更符合你的图片特点。

## 贡献指南

欢迎对本项目提出建议或贡献代码。如果您想参与开发，请遵循以下步骤：

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详情请参见 LICENSE 文件
