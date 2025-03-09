/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 启用静态导出
  distDir: 'out', // 输出目录
  images: {
    unoptimized: true, // 禁用图片优化，在静态导出时需要
  },
  // 禁用严格模式以避免开发中的双重渲染
  reactStrictMode: false,
  // 配置基础路径，在生产环境中可能需要调整
  basePath: '',
  // 禁用 X-Powered-By 头
  poweredByHeader: false,
};

module.exports = nextConfig;
