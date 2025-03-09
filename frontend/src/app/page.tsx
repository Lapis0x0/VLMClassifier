'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import ImageUploader from '../components/ImageUploader';
import ClassificationResults from '../components/ClassificationResults';
import SettingsModal from '../components/SettingsModal';
import ClassifiedGallery from '../components/ClassifiedGallery';
import config from '../config';

// 导入Tauri API
let invoke: any = null;
let tauriLoaded = false;

if (config.isTauri) {
  // 动态导入Tauri API
  import('@tauri-apps/api/tauri').then(tauri => {
    invoke = tauri.invoke;
    tauriLoaded = true;
    console.log('成功加载Tauri API');
    
    // 测试Tauri API是否正常工作
    import('@tauri-apps/api/app').then(app => {
      app.getVersion().then(version => {
        console.log('Tauri应用版本:', version);
      }).catch(err => {
        console.error('获取Tauri应用版本失败:', err);
      });
    }).catch(err => {
      console.error('加载Tauri app API失败:', err);
    });
  }).catch(err => {
    console.error('加载Tauri API失败:', err);
  });
}

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
  const [apiSettings, setApiSettings] = useState({
    apiBaseUrl: config.apiBaseUrl,
    apiKey: '',
    modelName: 'qwen-vl-plus-latest',
    prompt: '请分析这张图片属于哪个类别：二次元、生活照片、宠物、工作、表情包。只需回答类别名称，不要解释。',
  });

  // 从本地存储加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('apiSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setApiSettings(parsed);
      } catch (e) {
        console.error('解析保存的设置时出错:', e);
      }
    }
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
      
      console.log('当前环境:', config.isTauri ? 'Tauri应用' : '网页应用');
      console.log('Tauri API已加载:', tauriLoaded);
      console.log('invoke函数是否存在:', invoke ? '是' : '否');
      
      // 在Tauri环境中，尝试使用简单的命令测试IPC是否正常工作
      if (config.isTauri && invoke) {
        try {
          console.log('测试Tauri IPC...');
          const appDir = await invoke('classify_image', { imagePath: 'test.jpg' })
            .catch(e => {
              console.log('测试命令失败，这是预期的，因为文件不存在:', e);
              return null;
            });
          console.log('测试命令结果:', appDir);
        } catch (testError) {
          console.error('Tauri IPC测试失败:', testError);
        }
      }
      
      for (let i = 0; i < classifiedImages.length; i++) {
        const image = classifiedImages[i];
        
        if (!image.result) { // 仅分类尚未分类的图片
          console.log(`处理第${i+1}张图片: ${image.file.name}`);
          
          try {
            // 在Tauri环境中使用IPC机制
            if (config.isTauri && invoke) {
              try {
                // 首先需要将文件保存到临时目录
                console.log('开始保存临时文件...');
                const tempFilePath = await saveTempFile(image.file);
                console.log('临时文件路径:', tempFilePath);
                
                // 检查文件是否存在
                try {
                  const { exists } = await import('@tauri-apps/api/fs');
                  const fileExists = await exists(tempFilePath);
                  console.log('临时文件是否存在:', fileExists);
                  
                  if (!fileExists) {
                    throw new Error('临时文件不存在');
                  }
                } catch (fsError) {
                  console.error('检查文件存在性失败:', fsError);
                }
                
                // 调用Rust命令进行分类
                console.log('使用Tauri IPC进行分类，参数:', { imagePath: tempFilePath });
                const result = await invoke('classify_image', { imagePath: tempFilePath });
                console.log('IPC分类结果:', result);
                
                classifiedImages[i] = {
                  ...image,
                  result: result
                };
              } catch (ipcError) {
                console.error('IPC分类过程中出错:', ipcError);
                
                // 如果IPC失败，尝试使用HTTP请求作为备选方案
                console.log('IPC失败，尝试使用HTTP请求作为备选方案...');
                
                // 使用HTTP请求作为备选方案
                const formData = new FormData();
                formData.append('file', image.file);
                
                console.log('发送分类请求到:', `http://localhost:8000/classify`);
                
                const response = await fetch(`http://localhost:8000/classify`, {
                  method: 'POST',
                  body: formData,
                  headers: {
                    'X-API-Key': apiSettings.apiKey || '',
                  },
                });
                
                if (response.ok) {
                  const result = await response.json();
                  console.log('HTTP备选方案分类结果:', result);
                  classifiedImages[i] = {
                    ...image,
                    result: result
                  };
                } else {
                  throw new Error(`HTTP备选方案也失败: ${response.status}`);
                }
              }
            } 
            // 在网页环境中使用HTTP请求
            else {
              const formData = new FormData();
              formData.append('file', image.file);
              
              console.log('发送分类请求到:', `${apiSettings.apiBaseUrl}/classify`);
              console.log('使用API密钥:', apiSettings.apiKey ? '已设置' : '未设置');
              
              const response = await fetch(`${apiSettings.apiBaseUrl}/classify`, {
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
                try {
                  const errorJson = JSON.parse(errorText);
                  errorDetail = errorJson.detail || errorText;
                } catch (e) {
                  // 如果不是JSON格式，使用原始文本
                }
                
                alert(`分类请求失败 (${response.status}): ${errorDetail}`);
                break; // 出错时停止处理其他图片
              }
            }
          } catch (error) {
            console.error('分类错误:', error);
            alert(`分类错误: ${error instanceof Error ? error.message : String(error)}`);
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
  const handleSaveSettings = (settings: typeof apiSettings) => {
    setApiSettings(settings);
    setShowSettings(false);
    
    // 保存设置到本地存储
    localStorage.setItem('apiSettings', JSON.stringify(settings));
  };

  // 保存文件到临时目录
  const saveTempFile = async (file: File): Promise<string> => {
    if (!config.isTauri) {
      throw new Error('非Tauri环境不支持此操作');
    }
    
    try {
      console.log('开始导入Tauri文件系统API...');
      
      // 分开导入每个模块，避免类型错误
      const fs = await import('@tauri-apps/api/fs');
      const os = await import('@tauri-apps/api/os');
      const path = await import('@tauri-apps/api/path');
      
      console.log('成功导入Tauri文件系统API');
      
      // 尝试使用应用数据目录而不是临时目录
      let baseDirPath;
      try {
        baseDirPath = await path.appDataDir();
        console.log('应用数据目录:', baseDirPath);
      } catch (dirError) {
        console.error('获取应用数据目录失败，尝试使用临时目录:', dirError);
        baseDirPath = await os.tempdir();
        console.log('临时目录:', baseDirPath);
      }
      
      // 创建应用目录
      const appDir = await path.join(baseDirPath, 'vlmclassifier');
      console.log('应用目录:', appDir);
      
      // 创建应用目录
      try {
        console.log('尝试创建目录:', appDir);
        await fs.createDir(appDir, { recursive: true });
        console.log('目录创建成功或已存在');
      } catch (e) {
        console.error('创建目录失败:', e);
        // 尝试使用根目录
        console.log('尝试使用根目录');
      }
      
      // 检查目录是否存在
      const dirExists = await fs.exists(appDir);
      console.log('目录是否存在:', dirExists);
      
      // 生成唯一文件名
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${Date.now()}-${safeFileName}`;
      const filePath = await path.join(appDir, fileName);
      console.log('文件路径:', filePath);
      
      // 读取文件内容
      console.log('读取文件内容...');
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log('文件大小:', uint8Array.length, '字节');
      
      // 写入文件
      console.log('写入文件...');
      await fs.writeBinaryFile(filePath, uint8Array);
      console.log('文件写入成功');
      
      // 验证文件是否存在
      const fileExists = await fs.exists(filePath);
      console.log('文件是否存在:', fileExists);
      
      if (!fileExists) {
        throw new Error('文件写入后不存在');
      }
      
      return filePath;
    } catch (error) {
      console.error('保存临时文件失败:', error);
      throw error;
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
            <ClassifiedGallery apiBaseUrl={apiSettings.apiBaseUrl} />
          </div>
        </div>
      </main>
      
      {/* 设置模态框 */}
      {showSettings && (
        <SettingsModal
          settings={apiSettings}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
