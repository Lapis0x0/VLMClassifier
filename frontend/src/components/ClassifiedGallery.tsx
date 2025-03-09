'use client';

import { useState, useEffect, useRef } from 'react';
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
  const [page, setPage] = useState(1);
  const [imagesPerPage, setImagesPerPage] = useState(20);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedImage, setSelectedImage] = useState<ClassifiedImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<{[category: string]: number}>({});
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);
  const [reclassifySuccess, setReclassifySuccess] = useState<string | null>(null);
  const [draggedImage, setDraggedImage] = useState<ClassifiedImage | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuImage, setContextMenuImage] = useState<ClassifiedImage | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 获取已分类的图片
  const fetchClassifiedImages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 获取所有类别的图片数据，用于统计数量
      const allDataResponse = await fetch(`${apiBaseUrl}/classified-images`);
      if (allDataResponse.ok) {
        const allData = await allDataResponse.json();
        const categories = Object.keys(allData);
        setAllCategories(categories);
        
        // 保存每个类别的图片数量
        const counts: {[category: string]: number} = {};
        categories.forEach(category => {
          counts[category] = allData[category]?.length || 0;
        });
        setCategoryCounts(counts);
        
        // 如果没有选择特定类别，直接使用全部数据
        if (!selectedCategory) {
          setClassifiedImages(allData);
          setLoading(false);
          return;
        }
      }
      
      // 如果选择了特定类别，获取该类别的图片
      if (selectedCategory) {
        const url = `${apiBaseUrl}/classified-images?category=${encodeURIComponent(selectedCategory)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        setClassifiedImages(data);
      }
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
    // 重置页码
    setPage(1);
  }, [selectedCategory, apiBaseUrl]);

  // 使用保存的所有类别列表，而不是从当前图片数据中提取
  const categories = allCategories.length > 0 ? allCategories : Object.keys(classifiedImages);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 获取当前类别的所有图片
  const getAllImages = () => {
    if (selectedCategory) {
      return classifiedImages[selectedCategory] || [];
    }
    
    // 如果是全部类别，则合并所有类别的图片
    return categories.reduce((allImages, category) => {
      return [...allImages, ...(classifiedImages[category] || [])];
    }, [] as ClassifiedImage[]);
  };
  
  // 获取当前页的图片
  const getCurrentPageImages = () => {
    const allImages = getAllImages();
    const startIndex = (page - 1) * imagesPerPage;
    return allImages.slice(startIndex, startIndex + imagesPerPage);
  };
  
  // 计算总页数
  const totalPages = Math.ceil(getAllImages().length / imagesPerPage);
  
  // 处理图片点击，显示大图
  const handleImageClick = (image: ClassifiedImage) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };
  
  // 关闭图片模态框
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
    setTargetCategory('');
    setReclassifyError(null);
    setReclassifySuccess(null);
  };
  
  // 点击页面任何地方关闭右键菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 处理右键点击事件
  const handleContextMenu = (event: React.MouseEvent, image: ClassifiedImage) => {
    event.preventDefault();
    setContextMenuImage(image);
    setShowContextMenu(true);
    setContextMenuPosition({ 
      x: event.clientX, 
      y: event.clientY 
    });
  };

  // 处理拖拽开始
  const handleDragStart = (image: ClassifiedImage) => {
    setDraggedImage(image);
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setDraggedImage(null);
  };

  // 处理拖放目标的拖拽悬停
  const handleDragOver = (event: React.DragEvent, category: string) => {
    event.preventDefault();
  };

  // 处理拖放目标的放置
  const handleDrop = async (event: React.DragEvent, targetCategory: string) => {
    event.preventDefault();
    if (!draggedImage) return;

    // 从URL中提取当前类别
    const urlParts = draggedImage.url.split('/');
    const sourceCategory = urlParts[2]; // 格式为 /images/{category}/{filename}

    // 如果目标类别与源类别相同，不执行操作
    if (sourceCategory === targetCategory) return;

    // 调用重新分类函数
    await reclassifyImageToCategory(draggedImage, sourceCategory, targetCategory);
  };

  // 从右键菜单重新分类
  const handleContextMenuReclassify = async (targetCategory: string) => {
    if (!contextMenuImage) return;

    // 从URL中提取当前类别
    const urlParts = contextMenuImage.url.split('/');
    const sourceCategory = urlParts[2]; // 格式为 /images/{category}/{filename}

    // 如果目标类别与源类别相同，不执行操作
    if (sourceCategory === targetCategory) return;

    // 调用重新分类函数
    await reclassifyImageToCategory(contextMenuImage, sourceCategory, targetCategory);
    setShowContextMenu(false);
  };

  // 重新分类图片到指定类别的通用函数
  const reclassifyImageToCategory = async (image: ClassifiedImage, sourceCategory: string, targetCategory: string) => {
    setReclassifying(true);
    setReclassifyError(null);
    setReclassifySuccess(null);
    
    try {
      const params = new URLSearchParams({
        filename: image.filename,
        source_category: sourceCategory,
        target_category: targetCategory
      });
      
      const response = await fetch(`${apiBaseUrl}/reclassify-image?${params}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '重新分类失败');
      }
      
      const result = await response.json();
      setReclassifySuccess(result.message);
      
      // 更新图片数据
      await fetchClassifiedImages();
      
      // 如果是从模态框中分类的，延迟关闭模态框
      if (showImageModal) {
        setTimeout(() => {
          closeImageModal();
        }, 2000);
      }
    } catch (err) {
      console.error('重新分类图片失败:', err);
      setReclassifyError(err instanceof Error ? err.message : '重新分类图片失败');
    } finally {
      setReclassifying(false);
    }
  };

  // 从模态框重新分类图片
  const reclassifyImage = async () => {
    if (!selectedImage || !targetCategory) return;
    
    // 从URL中提取当前类别
    const urlParts = selectedImage.url.split('/');
    const sourceCategory = urlParts[2]; // 格式为 /images/{category}/{filename}
    
    // 如果目标类别与源类别相同，不执行操作
    if (sourceCategory === targetCategory) {
      setReclassifyError('目标类别与当前类别相同');
      return;
    }
    
    // 调用通用的重新分类函数
    await reclassifyImageToCategory(selectedImage, sourceCategory, targetCategory);
  };
  
  // 统计信息 - 使用保存的类别计数
  const totalImages = !selectedCategory ? 
    Object.values(categoryCounts).reduce((sum, count) => sum + count, 0) : 
    getAllImages().length;
    
  const categoryStats = categories.map(category => {
    return {
      name: category,
      // 使用保存的类别计数，而不是当前加载的图片数据
      count: categoryCounts[category] || 0
    };
  });
  
  return (
    <div className="bg-white rounded-lg shadow p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4">已分类图片库</h2>
      
      {/* 工具栏 */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <div className="flex gap-2">
          <button 
            onClick={fetchClassifiedImages}
            className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded"
          >
            刷新
          </button>
          
          <select 
            value={imagesPerPage} 
            onChange={(e) => {
              setImagesPerPage(Number(e.target.value));
              setPage(1); // 重置页码
            }}
            className="border rounded px-2 py-1"
          >
            <option value="10">10张/页</option>
            <option value="20">20张/页</option>
            <option value="50">50张/页</option>
            <option value="100">100张/页</option>
          </select>
          
          <div className="flex border rounded overflow-hidden">
            <button 
              onClick={() => setViewMode('grid')} 
              className={`px-3 py-1 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              网格
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              className={`px-3 py-1 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
            >
              列表
            </button>
          </div>
        </div>
        
        <div className="text-sm text-gray-500">
          共 {totalImages} 张图片
        </div>
      </div>
      
      {/* 类别选择 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button 
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded ${selectedCategory === null ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onDragOver={(e) => handleDragOver(e, 'all')}
          onDrop={(e) => e.preventDefault()}
        >
          全部
        </button>
        {categoryStats.map(cat => (
          <button 
            key={cat.name}
            onClick={() => setSelectedCategory(cat.name)}
            className={`px-3 py-1 rounded ${selectedCategory === cat.name ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onDragOver={(e) => handleDragOver(e, cat.name)}
            onDrop={(e) => handleDrop(e, cat.name)}
          >
            {cat.name} ({cat.count})
          </button>
        ))}
      </div>
      
      {/* 加载状态 */}
      {loading && <p className="text-gray-500">加载中...</p>}
      
      {/* 错误信息 */}
      {error && <p className="text-red-500">{error}</p>}
      
      {/* 图片展示区域 */}
      <div className="flex-grow overflow-y-auto">
        {totalImages === 0 && !loading && !error ? (
          <p className="text-gray-500 text-center py-8">暂无已分类的图片</p>
        ) : viewMode === 'grid' ? (
          // 网格视图
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {getCurrentPageImages().map(img => (
              <div 
                key={img.filename} 
                className="border rounded overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleImageClick(img)}
                onContextMenu={(e) => handleContextMenu(e, img)}
                draggable
                onDragStart={() => handleDragStart(img)}
                onDragEnd={handleDragEnd}
              >
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={`${apiBaseUrl}${img.url}`}
                    alt={img.filename}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="p-2 text-sm">
                  <p className="truncate text-xs">{img.filename}</p>
                  <p className="text-gray-500 text-xs">{formatFileSize(img.size)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // 列表视图
          <div className="border rounded overflow-hidden divide-y">
            {getCurrentPageImages().map(img => (
              <div 
                key={img.filename} 
                className="flex items-center p-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleImageClick(img)}
                onContextMenu={(e) => handleContextMenu(e, img)}
                draggable
                onDragStart={() => handleDragStart(img)}
                onDragEnd={handleDragEnd}
              >
                <div className="w-16 h-16 bg-gray-100 mr-3 flex-shrink-0">
                  <img
                    src={`${apiBaseUrl}${img.url}`}
                    alt={img.filename}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="truncate font-medium">{img.filename}</p>
                  <div className="flex text-sm text-gray-500 gap-3">
                    <span>{formatFileSize(img.size)}</span>
                    <span>{new Date(img.created).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 pt-3 border-t">
          <div className="text-sm text-gray-500">
            第 {page} 页，共 {totalPages} 页
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className={`px-2 py-1 rounded ${page === 1 ? 'text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              首页
            </button>
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className={`px-2 py-1 rounded ${page === 1 ? 'text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              上一页
            </button>
            <button
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              className={`px-2 py-1 rounded ${page === totalPages ? 'text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              下一页
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className={`px-2 py-1 rounded ${page === totalPages ? 'text-gray-400 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
            >
              末页
            </button>
          </div>
        </div>
      )}
      
      {/* 右键菜单 */}
      {showContextMenu && contextMenuImage && (
        <div 
          ref={contextMenuRef}
          className="fixed bg-white shadow-lg rounded-lg overflow-hidden z-50 border"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            maxWidth: '200px'
          }}
        >
          <div className="p-2 border-b bg-gray-50 text-sm font-medium truncate">
            {contextMenuImage.filename}
          </div>
          <div className="py-1">
            {allCategories.map(cat => {
              // 从URL中提取当前类别
              const urlParts = contextMenuImage.url.split('/');
              const currentCategory = urlParts[2]; // 格式为 /images/{category}/{filename}
              
              // 如果是当前类别，不显示在选项中
              if (cat === currentCategory) return null;
              
              return (
                <button
                  key={cat}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => handleContextMenuReclassify(cat)}
                  disabled={reclassifying}
                >
                  移动到 "{cat}"
                </button>
              );
            })}
          </div>
          <div className="border-t py-1">
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-blue-500"
              onClick={() => handleImageClick(contextMenuImage)}
            >
              查看图片
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-500"
              onClick={() => setShowContextMenu(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}
      
      {/* 图片查看模态框 */}
      {showImageModal && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-semibold">{selectedImage.filename}</h3>
              <button 
                onClick={closeImageModal}
                className="text-gray-500 hover:text-gray-700"
              >
                关闭
              </button>
            </div>
            <div className="flex-grow overflow-auto p-4 flex items-center justify-center bg-gray-100">
              <img
                src={`${apiBaseUrl}${selectedImage.url}`}
                alt={selectedImage.filename}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
            <div className="p-4 border-t text-sm">
              <p><span className="font-medium">文件名：</span> {selectedImage.filename}</p>
              <p><span className="font-medium">大小：</span> {formatFileSize(selectedImage.size)}</p>
              <p><span className="font-medium">创建时间：</span> {new Date(selectedImage.created).toLocaleString()}</p>
              <p><span className="font-medium">路径：</span> {selectedImage.path}</p>
              
              {/* 重新分类功能 */}
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <label className="font-medium">重新分类到：</label>
                  <select 
                    value={targetCategory}
                    onChange={(e) => setTargetCategory(e.target.value)}
                    className="border rounded px-2 py-1 flex-grow"
                    disabled={reclassifying}
                  >
                    <option value="">选择目标类别...</option>
                    {allCategories.map(cat => {
                      // 从URL中提取当前类别
                      const urlParts = selectedImage.url.split('/');
                      const currentCategory = urlParts[2]; // 格式为 /images/{category}/{filename}
                      
                      // 如果是当前类别，不显示在选项中
                      if (cat === currentCategory) return null;
                      
                      return (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={reclassifyImage}
                    disabled={!targetCategory || reclassifying}
                    className={`px-3 py-1 rounded ${!targetCategory || reclassifying ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                  >
                    {reclassifying ? '处理中...' : '确认'}
                  </button>
                </div>
                
                {/* 错误信息 */}
                {reclassifyError && (
                  <p className="text-red-500 mt-2">{reclassifyError}</p>
                )}
                
                {/* 成功信息 */}
                {reclassifySuccess && (
                  <p className="text-green-500 mt-2">{reclassifySuccess}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
