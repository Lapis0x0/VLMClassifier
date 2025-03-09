import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VLM图片分类器',
  description: '使用视觉语言模型对图片进行自动分类的web应用',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
