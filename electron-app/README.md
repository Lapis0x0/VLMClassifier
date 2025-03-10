# VLMClassifier Electron 桌面应用

这是VLMClassifier的Electron桌面应用版本，它将后端FastAPI服务和前端Next.js应用打包成一个独立的桌面应用。

## 开发说明

### 环境准备

1. 安装Node.js和npm
2. 安装项目依赖：

```bash
cd electron-app
npm install
```

### 开发模式运行

在开发模式下，Electron应用会连接到本地运行的Next.js开发服务器：

1. 首先启动前端开发服务器：

```bash
cd ../frontend
npm run dev
```

2. 在另一个终端中启动Electron应用：

```bash
cd ../electron-app
npm run dev
```

### 构建桌面应用

构建独立的桌面应用程序：

1. 首先构建Next.js应用：

```bash
cd ../frontend
npm run build
npm run export  # 导出静态HTML文件到out目录
```

2. 然后构建Electron应用：

```bash
cd ../electron-app
npm run build  # 构建所有平台
# 或者
npm run build:mac  # 仅构建macOS版本
npm run build:win  # 仅构建Windows版本
```

构建完成后，可执行文件将位于`electron-app/dist`目录中。

## 注意事项

- 在构建过程中，应用会自动启动后端服务
- 请确保已经安装了所有必要的Python依赖
- 如果遇到权限问题，可能需要以管理员身份运行
- 图标文件应放置在`src/icons`目录中
