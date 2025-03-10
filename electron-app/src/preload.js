const { contextBridge, ipcRenderer } = require('electron');

// 在window对象上暴露API给渲染进程使用
contextBridge.exposeInMainWorld('electron', {
  // 文件操作
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  
  // 接收来自主进程的消息
  onSelectedFiles: (callback) => {
    ipcRenderer.on('selected-files', (event, files) => callback(files));
    return () => ipcRenderer.removeAllListeners('selected-files');
  },
  onSelectedDirectory: (callback) => {
    ipcRenderer.on('selected-directory', (event, directory) => callback(directory));
    return () => ipcRenderer.removeAllListeners('selected-directory');
  },
  onBackendReady: (callback) => {
    ipcRenderer.on('backend-ready', () => callback());
    return () => ipcRenderer.removeAllListeners('backend-ready');
  }
});
