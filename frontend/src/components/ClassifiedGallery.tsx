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
  
  // 框选相关状态
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [selectedImages, setSelectedImages] = useState<ClassifiedImage[]>([]);
  const [showBatchActionMenu, setShowBatchActionMenu] = useState(false);
  const [batchActionMenuPosition, setBatchActionMenuPosition] = useState({ x: 0, y: 0 });
  const batchActionMenuRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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
  
  // 点击页面任何地方关闭右键菜单和批量操作菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
      if (batchActionMenuRef.current && !batchActionMenuRef.current.contains(event.target as Node)) {
        setShowBatchActionMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  

  
  // 框选相关函数
  const startSelection = (e: MouseEvent) => {
    if (!galleryRef.current) return;
    
    // 记录鼠标在文档中的位置
    setIsSelecting(true);
    setSelectionStart({ x: e.clientX, y: e.clientY });
    setSelectionEnd({ x: e.clientX, y: e.clientY });
    setSelectedImages([]);
  };
  
  const updateSelection = (e: MouseEvent) => {
    if (!isSelecting || !galleryRef.current) return;
    
    // 更新鼠标当前位置
    setSelectionEnd({ x: e.clientX, y: e.clientY });
    
    // 获取画廊元素的位置信息
    const galleryRect = galleryRef.current.getBoundingClientRect();
    
    // 计算选择框在文档中的位置
    const selectionRect = {
      left: Math.min(selectionStart.x, selectionEnd.x),
      top: Math.min(selectionStart.y, selectionEnd.y),
      right: Math.max(selectionStart.x, selectionEnd.x),
      bottom: Math.max(selectionStart.y, selectionEnd.y)
    };
    
    const selected: ClassifiedImage[] = [];
    const currentImages = getCurrentPageImages();
    
    currentImages.forEach((img) => {
      const imgElement = imageRefs.current.get(img.filename);
      if (imgElement) {
        // 获取图片在文档中的位置
        const imgRect = imgElement.getBoundingClientRect();
        
        // 检查图片是否与选择框相交
        if (
          imgRect.right >= selectionRect.left &&
          imgRect.left <= selectionRect.right &&
          imgRect.bottom >= selectionRect.top &&
          imgRect.top <= selectionRect.bottom
        ) {
          selected.push(img);
        }
      }
    });
    
    setSelectedImages(selected);
  };
  
  const endSelection = (e: MouseEvent) => {
    if (!isSelecting) return;
    
    setIsSelecting(false);
    
    // 如果选中了图片，显示批量操作菜单
    if (selectedImages.length > 0) {
      // 计算菜单应该显示的位置
      // 防止菜单超出屏幕边缘
      const menuX = Math.min(e.clientX, window.innerWidth - 250);
      const menuY = Math.min(e.clientY, window.innerHeight - 300);
      setBatchActionMenuPosition({ x: menuX, y: menuY });
      setShowBatchActionMenu(true);
      
      // 防止默认行为
      e.preventDefault();
    }
  };
  
  // 添加点击外部关闭批量操作菜单的事件监听器
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showBatchActionMenu && batchActionMenuRef.current && !batchActionMenuRef.current.contains(e.target as Node)) {
        setShowBatchActionMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBatchActionMenu]);
  
  // 添加一个状态来跟踪是否正在拖拽图片
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // 在组件挂载时添加鼠标事件监听器
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      // 如果菜单已经打开或正在拖拽图片，则不进行框选
      if (showBatchActionMenu || isDraggingImage) return;
      
      // 如果不是左键点击或者按住了Ctrl/Command键，不进行框选
      if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
      
      // 检查点击是否发生在图片元素上
      const target = e.target as HTMLElement;
      const isOnImage = target.tagName === 'IMG' || 
                      target.closest('.image-item') !== null;
      
      // 如果点击在图片上，不进行框选
      if (isOnImage) return;
      
      // 开始框选
      startSelection(e);
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingImage) {
        updateSelection(e);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingImage) {
        endSelection(e);
      }
    };
    
    // 添加事件监听器
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // 清理函数
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSelecting, selectionStart, selectedImages, showBatchActionMenu, isDraggingImage]);
  

  

  
  // 获取选择框的位置和尺寸
  const getSelectionRect = () => {
    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const right = Math.max(selectionStart.x, selectionEnd.x);
    const bottom = Math.max(selectionStart.y, selectionEnd.y);
    
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };
  
  // 获取选择框的可见部分（显示在画廊区域内）
  const getVisibleSelectionRect = () => {
    if (!galleryRef.current) return { left: 0, top: 0, width: 0, height: 0 };
    
    const galleryRect = galleryRef.current.getBoundingClientRect();
    const selectionRect = getSelectionRect();
    
    // 显示完整的选择框，不限制在画廊区域内
    return { 
      left: selectionRect.left, 
      top: selectionRect.top, 
      width: selectionRect.width, 
      height: selectionRect.height 
    };
  };
  
  // 批量重新分类图片
  const batchReclassify = async (targetCategory: string) => {
    if (selectedImages.length === 0) return;
    
    setReclassifying(true);
    setReclassifyError(null);
    setReclassifySuccess(null);
    
    try {
      // 记录成功重分类的图片数量
      let successCount = 0;
      let errorCount = 0;
      
      // 依次处理每张图片
      for (const image of selectedImages) {
        try {
          // 从URL中提取当前类别
          const urlParts = image.url.split('/');
          const sourceCategory = urlParts[2]; // 格式为 /images/{category}/{filename}
          
          // 如果目标类别与源类别相同，跳过
          if (sourceCategory === targetCategory) continue;
          
          // 调用API重新分类
          const params = new URLSearchParams({
            filename: image.filename,
            source_category: sourceCategory,
            target_category: targetCategory
          });
          
          console.log(`尝试将图片 ${image.filename} 从 ${sourceCategory} 移动到 ${targetCategory}`);
          
          const response = await fetch(`${apiBaseUrl}/reclassify-image?${params}`, {
            method: 'POST',
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error(`重分类图片 ${image.filename} 失败:`, errorData);
            errorCount++;
          } else {
            successCount++;
            console.log(`成功将图片 ${image.filename} 从 ${sourceCategory} 移动到 ${targetCategory}`);
          }
        } catch (error) {
          console.error(`重分类图片 ${image.filename} 时发生错误:`, error);
          errorCount++;
        }
      }
      
      // 更新图片数据
      await fetchClassifiedImages();
      
      if (successCount > 0) {
        setReclassifySuccess(`已成功将 ${successCount} 张图片重新分类到 ${targetCategory}${errorCount > 0 ? `，${errorCount} 张图片处理失败` : ''}`);
      } else {
        setReclassifyError(`没有图片被重新分类${errorCount > 0 ? `，${errorCount} 张图片处理失败` : ''}，请检查是否选择了正确的目标类别`);
      }
      
      // 清除选中状态
      setSelectedImages([]);
      setShowBatchActionMenu(false);
    } catch (err) {
      console.error('批量重新分类图片失败:', err);
      setReclassifyError(err instanceof Error ? err.message : '批量重新分类图片失败');
    } finally {
      setReclassifying(false);
    }
  };

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
    setIsDraggingImage(true);
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setDraggedImage(null);
    // 添加小延迟，确保拖拽结束后不会立即触发框选
    setTimeout(() => {
      setIsDraggingImage(false);
    }, 100);
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
      <div 
        className="flex-grow overflow-y-auto relative select-none"
        ref={galleryRef}
      >
        {totalImages === 0 && !loading && !error ? (
          <p className="text-gray-500 text-center py-8">暂无已分类的图片</p>
        ) : viewMode === 'grid' ? (
          // 网格视图
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {getCurrentPageImages().map(img => (
              <div 
                key={img.filename} 
                className={`border rounded overflow-hidden cursor-pointer hover:shadow-md transition-shadow image-item ${selectedImages.some(selected => selected.filename === img.filename) ? 'ring-2 ring-blue-500' : ''}`}
                onClick={(e) => {
                  // 如果正在框选，不触发点击事件
                  if (!isSelecting) {
                    handleImageClick(img);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, img)}
                draggable
                onDragStart={() => handleDragStart(img)}
                onDragEnd={handleDragEnd}
                ref={(el) => {
                  if (el) {
                    imageRefs.current.set(img.filename, el);
                  }
                }}
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
                className={`flex items-center p-2 hover:bg-gray-50 cursor-pointer ${selectedImages.some(selected => selected.filename === img.filename) ? 'bg-blue-50 ring-1 ring-blue-500' : ''}`}
                onClick={(e) => {
                  // 如果正在框选，不触发点击事件
                  if (!isSelecting) {
                    handleImageClick(img);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, img)}
                draggable
                onDragStart={() => handleDragStart(img)}
                onDragEnd={handleDragEnd}
                ref={(el) => {
                  if (el) {
                    imageRefs.current.set(img.filename, el);
                  }
                }}
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
      
      {/* 框选区域 - 使用固定定位以相对于整个文档定位 */}
      {isSelecting && (
        <div 
          className="fixed border-2 border-blue-500 bg-blue-100 bg-opacity-30 pointer-events-none z-50"
          style={{
            left: `${Math.min(selectionStart.x, selectionEnd.x)}px`,
            top: `${Math.min(selectionStart.y, selectionEnd.y)}px`,
            width: `${Math.abs(selectionEnd.x - selectionStart.x)}px`,
            height: `${Math.abs(selectionEnd.y - selectionStart.y)}px`,
          }}
        />
      )}
      
      {/* 批量操作菜单 */}
      {showBatchActionMenu && selectedImages.length > 0 && (
        <div 
          ref={batchActionMenuRef}
          className="fixed bg-white shadow-lg rounded-lg overflow-hidden z-50 border"
          style={{
            left: `${batchActionMenuPosition.x}px`,
            top: `${batchActionMenuPosition.y}px`,
            maxWidth: '250px'
          }}
        >
          <div className="p-2 border-b bg-gray-50 text-sm font-medium">
            已选择 {selectedImages.length} 张图片
          </div>
          <div className="py-1">
            <div className="px-4 py-2 text-sm font-medium">移动到类别：</div>
            {allCategories.map(cat => {
              // 检查选中的图片是否都属于同一类别
              const allSameCategory = selectedImages.every(img => {
                const urlParts = img.url.split('/');
                const sourceCategory = urlParts[2];
                return sourceCategory === cat;
              });
              
              // 如果所有图片都属于该类别，则禁用该选项
              return (
                <button
                  key={cat}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => batchReclassify(cat)}
                  disabled={allSameCategory || reclassifying}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <div className="border-t py-1">
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-500"
              onClick={() => {
                setSelectedImages([]);
                setShowBatchActionMenu(false);
              }}
            >
              取消选择
            </button>
          </div>
        </div>
      )}
      
      {/* 重新分类结果提示 */}
      {(reclassifySuccess || reclassifyError) && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 ${reclassifyError ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
          {reclassifySuccess || reclassifyError}
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
