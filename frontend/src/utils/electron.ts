/**
 * Electron集成工具
 * 提供与Electron主进程通信的方法
 */

// 定义Electron API接口
interface ElectronAPI {
  openFileDialog: () => Promise<string[]>;
  openDirectoryDialog: () => Promise<string | null>;
  onSelectedFiles: (callback: (files: string[]) => void) => () => void;
  onSelectedDirectory: (callback: (directory: string) => void) => () => void;
  onBackendReady: (callback: () => void) => () => void;
}

// 声明全局Window接口
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

// 检查是否在Electron环境中运行
export const isElectron = (): boolean => {
  return window.electron !== undefined;
};

// 打开文件选择对话框
export const openFileDialog = async (): Promise<string[]> => {
  if (isElectron()) {
    return window.electron!.openFileDialog();
  }
  return [];
};

// 打开目录选择对话框
export const openDirectoryDialog = async (): Promise<string | null> => {
  if (isElectron()) {
    return window.electron!.openDirectoryDialog();
  }
  return null;
};

// 监听选择的文件
export const onSelectedFiles = (callback: (files: string[]) => void): (() => void) => {
  if (isElectron()) {
    return window.electron!.onSelectedFiles(callback);
  }
  return () => {};
};

// 监听选择的目录
export const onSelectedDirectory = (callback: (directory: string) => void): (() => void) => {
  if (isElectron()) {
    return window.electron!.onSelectedDirectory(callback);
  }
  return () => {};
};

// 监听后端服务就绪事件
export const onBackendReady = (callback: () => void): (() => void) => {
  if (isElectron()) {
    return window.electron!.onBackendReady(callback);
  }
  return () => {};
};
