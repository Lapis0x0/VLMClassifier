'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import ImageUploader from '../components/ImageUploader';
import ClassificationResults from '../components/ClassificationResults';
import SettingsModal from '../components/SettingsModal';
import ClassifiedGallery from '../components/ClassifiedGallery';

// 定义分类结果类型
type ClassificationResult = {
  category: string;
  confidence: number;
  original_response: string;
};

// 定义图片类型
type ImageItem = {
  file: File;
  preview: string;
  result?: ClassificationResult;
  id: string;
};

export default function Home() {
  // 状态管理
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // 分离后端服务器URL和OpenAI API基础URL
  const [backendUrl, setBackendUrl] = useState('http://localhost:8001');
  const [apiSettings, setApiSettings] = useState({
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelName: 'gpt-4-vision-preview',
    prompt: '请分析这张图片属于哪个类别：二次元、生活照片、宠物、工作、表情包。只需回答类别名称，不要解释。',
  });

  // 从本地存储和后端加载设置
  useEffect(() => {
    // 先从本地存储加载
    const savedSettings = localStorage.getItem('apiSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setApiSettings(parsed);
      } catch (e) {
        console.error('解析保存的设置时出错:', e);
      }
    }
    
    // 加载后端 URL
    const savedBackendUrl = localStorage.getItem('backendUrl');
    if (savedBackendUrl) {
      setBackendUrl(savedBackendUrl);
    }
    
    // 然后从后端获取配置
    const fetchConfig = async () => {
      try {
        // 使用后端服务器URL来获取配置
        const response = await fetch(`${backendUrl}/config`);
        
        if (response.ok) {
          const config = await response.json();
          
          // 合并配置，但保留本地存储中的值如果它们存在
          const mergedSettings = {
            ...apiSettings,
            // 如果后端有值且本地没有设置，则使用后端的值
            apiKey: apiSettings.apiKey || config.apiKey || '',
            apiBaseUrl: apiSettings.apiBaseUrl,  // 保留前端的基础URL
            modelName: apiSettings.modelName || config.modelName || 'qwen-vl-plus-latest',
          };
          
          setApiSettings(mergedSettings);
          
          // 更新本地存储
          localStorage.setItem('apiSettings', JSON.stringify(mergedSettings));
        }
      } catch (error) {
        console.warn('从后端获取配置失败:', error);
        // 失败时不阻止应用继续运行
      }
    };
    
    fetchConfig();
  }, []);

  // 处理图片添加
  const handleImagesAdded = (files: File[]) => {
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Math.random().toString(36).substring(2, 11)
    }));
    
    setImages(prev => [...prev, ...newImages]);
  };

  // 处理图片删除
  const handleRemoveImage = (id: string) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      // 释放URL对象
      const removed = prev.find(img => img.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
      }
      return updated;
    });
  };

  // 处理图片分类
  const handleClassify = async () => {
    if (images.length === 0) return;
    
    setIsClassifying(true);
    
    try {
      const classifiedImages = [...images];
      
      for (let i = 0; i < classifiedImages.length; i++) {
        const image = classifiedImages[i];
        
        if (!image.result) { // 仅分类尚未分类的图片
          const formData = new FormData();
          formData.append('file', image.file);
          
          console.log('发送分类请求到:', backendUrl);
          console.log('使用API密钥:', apiSettings.apiKey ? '已设置' : '未设置');
          
          try {
            const response = await fetch(`${backendUrl}/classify`, {
              method: 'POST',
              body: formData,
              headers: {
                'X-API-Key': apiSettings.apiKey || '',
              },
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('分类结果:', result);
              classifiedImages[i] = {
                ...image,
                result: result
              };
            } else {
              const errorText = await response.text();
              console.error(`分类请求失败 (${response.status}):`, errorText);
              
              // 尝试解析错误详情
              let errorDetail = errorText;
              let errorJson;
              
              try {
                errorJson = JSON.parse(errorText);
                errorDetail = errorJson.error || errorJson.detail || errorText;
              } catch (e) {
                // 如果不是JSON格式，使用原始文本
              }
              
              // 处理特定类型的错误
              if (errorDetail.includes('未设置API密钥') || errorDetail.includes('未设置基础URL')) {
                alert('请先设置API密钥和基础URL。点击右上角的设置图标进行配置。');
                setShowSettings(true); // 自动打开设置模态窗口
              } else {
                alert(`分类请求失败 (${response.status}): ${errorDetail}`);
              }
              
              break; // 出错时停止处理其他图片
            }
          } catch (fetchError) {
            console.error('网络请求错误:', fetchError);
            alert(`网络请求错误: ${fetchError.message}`);
            break;
          }
        }
      }
      
      setImages(classifiedImages);
    } catch (error) {
      console.error('分类失败:', error);
      alert(`分类过程中出错: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsClassifying(false);
    }
  };

  // 清空所有图片
  const handleClearAll = () => {
    // 释放所有URL对象
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
  };

  // 保存设置
  const handleSaveSettings = async (settings: typeof apiSettings, newBackendUrl: string) => {
    setApiSettings(settings);
    setBackendUrl(newBackendUrl);
    setShowSettings(false);
    
    // 保存设置到本地存储
    localStorage.setItem('apiSettings', JSON.stringify(settings));
    localStorage.setItem('backendUrl', newBackendUrl);
    
    // 通过API更新后端的配置
    try {
      const response = await fetch(`${backendUrl}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: settings.apiKey,
          apiBaseUrl: settings.apiBaseUrl,
          modelName: settings.modelName
        })
      });
      
      if (response.ok) {
        console.log('后端配置更新成功');
      } else {
        console.warn('更新后端配置失败:', await response.text());
      }
    } catch (error) {
      console.error('更新后端配置时出错:', error);
      // 不阻止用户继续使用应用
    }
  };

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        onSettingsClick={() => setShowSettings(true)} 
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* 左侧区域 - 上传和分类结果 */}
          <div className="md:w-2/3 flex flex-col gap-8">
            {/* 图片上传区域 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">图片上传</h2>
              <ImageUploader 
                onImagesAdded={handleImagesAdded}
                disabled={isClassifying}
              />
              
              {/* 按钮组 */}
              <div className="flex mt-4 space-x-4">
                <button 
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleClassify}
                  disabled={images.length === 0 || isClassifying}
                >
                  {isClassifying ? '分类中...' : '开始分类'}
                </button>
                
                <button 
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleClearAll}
                  disabled={images.length === 0 || isClassifying}
                >
                  清空所有
                </button>
              </div>
            </div>
            
            {/* 分类结果区域 */}
            {images.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">分类结果</h2>
                <ClassificationResults 
                  images={images}
                  onRemoveImage={handleRemoveImage}
                  isClassifying={isClassifying}
                />
              </div>
            )}
          </div>
          
          {/* 右侧区域 - 已分类图片库 */}
          <div className="md:w-1/3">
            <ClassifiedGallery apiBaseUrl={backendUrl} />
          </div>
        </div>
      </main>
      
      {/* 设置模态框 */}
      {showSettings && (
        <SettingsModal
          settings={apiSettings}
          backendUrl={backendUrl}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
