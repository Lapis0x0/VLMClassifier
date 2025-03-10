const { contextBridge, ipcRenderer } = require('electron');

// 在window对象上暴露API给渲染进程使用
contextBridge.exposeInMainWorld('electron', {
  // 文件操作
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config) => ipcRenderer.invoke('update-config', config),
  openConfigDialog: () => ipcRenderer.invoke('open-config-dialog'),
  
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
  },
  onConfigUpdated: (callback) => {
    ipcRenderer.on('config-updated', (event, result) => callback(result));
    return () => ipcRenderer.removeAllListeners('config-updated');
  }
});
