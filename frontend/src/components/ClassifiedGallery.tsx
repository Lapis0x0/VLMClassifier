'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

type ClassifiedImage = {
  filename: string;
  path: string;
  url: string;
  size: number;
  created: string;
};

type ClassifiedImagesData = {
  [category: string]: ClassifiedImage[];
};

interface ClassifiedGalleryProps {
  apiBaseUrl: string;
}

export default function ClassifiedGallery({ apiBaseUrl }: ClassifiedGalleryProps) {
  const [classifiedImages, setClassifiedImages] = useState<ClassifiedImagesData>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取已分类的图片
  const fetchClassifiedImages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = selectedCategory 
        ? `${apiBaseUrl}/classified-images?category=${encodeURIComponent(selectedCategory)}`
        : `${apiBaseUrl}/classified-images`;
        
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setClassifiedImages(data);
    } catch (err) {
      console.error('获取已分类图片失败:', err);
      setError(err instanceof Error ? err.message : '获取已分类图片失败');
    } finally {
      setLoading(false);
    }
  };

  // 组件加载时获取图片
  useEffect(() => {
    fetchClassifiedImages();
  }, [selectedCategory, apiBaseUrl]);

  // 获取所有类别
  const categories = Object.keys(classifiedImages);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 h-full">
      <h2 className="text-xl font-bold mb-4">已分类图片库</h2>
      
      {/* 刷新按钮 */}
      <button 
        onClick={fetchClassifiedImages}
        className="mb-4 bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded"
      >
        刷新图片库
      </button>
      
      {/* 类别选择 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button 
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded ${selectedCategory === null ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          全部
        </button>
        {categories.map(category => (
          <button 
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 rounded ${selectedCategory === category ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            {category} ({classifiedImages[category]?.length || 0})
          </button>
        ))}
      </div>
      
      {/* 加载状态 */}
      {loading && <p className="text-gray-500">加载中...</p>}
      
      {/* 错误信息 */}
      {error && <p className="text-red-500">{error}</p>}
      
      {/* 图片展示 */}
      <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[calc(100vh-300px)]">

        {categories.map(category => {
          // 如果选择了特定类别，只显示该类别
          if (selectedCategory !== null && selectedCategory !== category) {
            return null;
          }
          
          const images = classifiedImages[category] || [];
          
          if (images.length === 0) {
            return selectedCategory === category || selectedCategory === null ? (
              <div key={category} className="col-span-full">
                <h3 className="font-semibold text-lg">{category}</h3>
                <p className="text-gray-500">暂无图片</p>
              </div>
            ) : null;
          }
          
          return (
            <div key={category} className={selectedCategory === null ? "col-span-full mb-6" : ""}>
              {selectedCategory === null && <h3 className="font-semibold text-lg mb-2">{category}</h3>}
              
              <div className="grid grid-cols-1 gap-3">
                {images.map(img => (
                  <div key={img.filename} className="border rounded overflow-hidden">
                    <div className="relative h-40 bg-gray-100">
                      <img
                        src={`${apiBaseUrl}${img.url}`}
                        alt={img.filename}
                        className="object-contain w-full h-full"
                      />
                    </div>
                    <div className="p-2 text-sm">
                      <p className="truncate text-xs">{img.filename}</p>
                      <p className="text-gray-500">{formatFileSize(img.size)}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(img.created).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* 没有图片时的提示 */}
      {categories.length === 0 && !loading && !error && (
        <p className="text-gray-500">暂无已分类的图片</p>
      )}
    </div>
  );
}
