import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VLM分类器",
  description: "使用视觉语言模型对图片进行自动分类的应用程序",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
