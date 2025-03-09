// 配置文件，用于管理不同环境下的API基础URL

// 为Tauri声明全局类型
declare global {
  interface Window {
    __TAURI__?: any;
  }
}

// 判断是否在Tauri环境中运行
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

// 根据环境设置API基础URL
export const getApiBaseUrl = () => {
  // 在Tauri应用中，后端服务运行在本地的8000端口
  if (isTauri) {
    return 'http://localhost:8000';
  }
  
  // 在开发环境中，使用相对路径
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8000';
  }
  
  // 在生产环境中，使用相对路径（假设前后端部署在同一服务器）
  return '/api';
};

// 导出默认配置
const config = {
  apiBaseUrl: getApiBaseUrl(),
  isTauri: isTauri,
};

export default config;
