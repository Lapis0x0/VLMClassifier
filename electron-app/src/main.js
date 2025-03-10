const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');
const axios = require('axios');
const isDev = require('electron-is-dev');
const log = require('electron-log');

// 配置日志
log.transports.file.level = 'info';
log.info('应用启动');

// 保存主窗口的引用，避免被JavaScript的垃圾回收机制回收
let mainWindow;
let backendProcess = null;
const API_URL = 'http://localhost:8001';

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false, // 先不显示窗口，等加载完成后再显示
    icon: path.join(__dirname, 'icons', 'icon.png')
  });

  // 设置窗口标题
  mainWindow.setTitle('VLM图像分类器');

  // 加载应用
  const startUrl = isDev 
    ? 'http://localhost:3000' // 开发模式：使用Next.js开发服务器
    : url.format({
        pathname: path.join(__dirname, '../../frontend/out/index.html'), // 生产模式：使用Next.js静态导出
        protocol: 'file:',
        slashes: true
      });
  
  log.info(`加载URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 当窗口关闭时触发
  mainWindow.on('closed', () => {
    mainWindow = null;
    stopBackend();
  });

  // 创建菜单
  createMenu();
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '选择图片',
          click: () => {
            dialog.showOpenDialog(mainWindow, {
              properties: ['openFile', 'multiSelections'],
              filters: [
                { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
              ]
            }).then(result => {
              if (!result.canceled && result.filePaths.length > 0) {
                mainWindow.webContents.send('selected-files', result.filePaths);
              }
            });
          }
        },
        {
          label: '选择文件夹',
          click: () => {
            dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory']
            }).then(result => {
              if (!result.canceled && result.filePaths.length > 0) {
                mainWindow.webContents.send('selected-directory', result.filePaths[0]);
              }
            });
          }
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'delete', label: '删除' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              title: '关于 VLM图像分类器',
              message: 'VLM图像分类器',
              detail: '版本 1.0.0\n使用视觉语言模型(VLM)对图片进行自动分类的应用程序。',
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 启动后端服务
function startBackend() {
  log.info('启动后端服务...');
  
  // 检查后端是否已经在运行
  axios.get(`${API_URL}/`)
    .then(() => {
      log.info('后端服务已经在运行');
    })
    .catch(() => {
      log.info('后端服务未运行，正在启动...');
      
      // 确定后端脚本路径
      const backendPath = path.join(app.getAppPath(), '../../backend/main.py');
      log.info(`后端路径: ${backendPath}`);
      
      // 启动后端进程
      backendProcess = spawn('python', [backendPath], {
        detached: false,
        stdio: 'pipe'
      });
      
      backendProcess.stdout.on('data', (data) => {
        log.info(`后端输出: ${data}`);
      });
      
      backendProcess.stderr.on('data', (data) => {
        log.error(`后端错误: ${data}`);
      });
      
      backendProcess.on('close', (code) => {
        log.info(`后端进程退出，代码: ${code}`);
        backendProcess = null;
      });
      
      // 等待后端启动
      waitForBackend();
    });
}

// 等待后端服务启动
function waitForBackend(attempts = 0, maxAttempts = 30) {
  if (attempts >= maxAttempts) {
    log.error('后端服务启动超时');
    dialog.showErrorBox(
      '启动错误',
      '无法启动后端服务，请检查Python环境和依赖是否正确安装。'
    );
    return;
  }
  
  log.info(`等待后端服务启动，尝试 ${attempts + 1}/${maxAttempts}...`);
  
  axios.get(`${API_URL}/`)
    .then(() => {
      log.info('后端服务已启动');
      mainWindow.webContents.send('backend-ready');
    })
    .catch(() => {
      // 等待1秒后再次尝试
      setTimeout(() => waitForBackend(attempts + 1, maxAttempts), 1000);
    });
}

// 停止后端服务
function stopBackend() {
  if (backendProcess) {
    log.info('停止后端服务...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
    } else {
      backendProcess.kill();
    }
    backendProcess = null;
  }
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow();
  startBackend();
  
  // 在macOS上，当点击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当所有窗口关闭时退出应用，除了在macOS上。
// 在macOS上，应用程序及其菜单栏通常会保持活动状态，
// 直到用户使用Cmd + Q明确退出。
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在应用退出前尝试停止后端服务
app.on('before-quit', () => {
  stopBackend();
});

// IPC通信处理
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePaths;
  }
  return [];
});

ipcMain.handle('open-directory-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});
