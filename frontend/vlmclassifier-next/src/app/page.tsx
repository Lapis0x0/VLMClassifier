export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <main className="flex flex-col items-center p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">VLM分类器</h1>
        <p className="text-gray-600 mb-6">正在加载应用程序，请稍候...</p>
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    </div>
  );
}
