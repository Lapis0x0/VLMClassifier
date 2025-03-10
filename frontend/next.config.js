/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // 禁用图片优化，这在静态导出时可能会更好
  images: {
    unoptimized: true,
  },
  // 设置资源前缀，确保在file://协议下能正确加载资源
  assetPrefix: './',
  // 禁用严格模式以避免某些开发时的问题
  reactStrictMode: false,
  // 确保CSS文件能够被正确加载
  experimental: {
    // 这些选项可能有助于解决CSS加载问题
    esmExternals: 'loose',
  },
};

module.exports = nextConfig;
