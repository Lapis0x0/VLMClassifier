import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { isElectron, openFileDialog, openDirectoryDialog, onSelectedFiles, onSelectedDirectory } from '../utils/electron';

interface ImageUploaderProps {
  onImagesAdded: (files: File[]) => void;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesAdded, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isElectronApp, setIsElectronApp] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // 过滤出图片文件
    const imageFiles = acceptedFiles.filter(file => 
      file.type.startsWith('image/')
    );
    
    if (imageFiles.length > 0) {
      onImagesAdded(imageFiles);
    }
  }, [onImagesAdded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    disabled
  });

  // 检查是否在Electron环境中运行
  useEffect(() => {
    setIsElectronApp(isElectron());
  }, []);

  // 监听从Electron主进程传来的文件选择事件
  useEffect(() => {
    if (isElectronApp) {
      const removeFileListener = onSelectedFiles((filePaths) => {
        handleElectronFiles(filePaths);
      });

      const removeDirectoryListener = onSelectedDirectory((dirPath) => {
        handleElectronDirectory(dirPath);
      });

      return () => {
        removeFileListener();
        removeDirectoryListener();
      };
    }
  }, [isElectronApp, onImagesAdded]);

  // 处理从Electron选择的文件
  const handleElectronFiles = async (filePaths: string[]) => {
    if (disabled || filePaths.length === 0) return;
    
    try {
      const files = await Promise.all(
        filePaths.map(async (path) => {
          // 从文件路径创建File对象
          const response = await fetch(`file://${path}`);
          const blob = await response.blob();
          const filename = path.split(/[\\/]/).pop() || 'image.jpg';
          return new File([blob], filename, { type: blob.type || 'image/jpeg' });
        })
      );
      
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onImagesAdded(imageFiles);
      }
    } catch (error) {
      console.error('处理Electron文件时出错:', error);
    }
  };

  // 处理从Electron选择的目录
  const handleElectronDirectory = async (dirPath: string) => {
    if (disabled || !dirPath) return;
    
    try {
      // 这里需要通过API获取目录中的所有图片文件
      // 由于浏览器环境限制，我们需要通过后端API来处理
      const response = await fetch(`http://localhost:8001/scan-directory?path=${encodeURIComponent(dirPath)}`);
      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        handleElectronFiles(data.files);
      }
    } catch (error) {
      console.error('处理Electron目录时出错:', error);
    }
  };

  // 打开文件选择对话框
  const handleSelectFiles = async () => {
    if (disabled) return;
    
    if (isElectronApp) {
      const filePaths = await openFileDialog();
      if (filePaths.length > 0) {
        handleElectronFiles(filePaths);
      }
    } else {
      // 在Web环境中，模拟点击文件输入框
      document.getElementById('fileInput')?.click();
    }
  };

  // 打开目录选择对话框
  const handleSelectDirectory = async () => {
    if (disabled || !isElectronApp) return;
    
    const dirPath = await openDirectoryDialog();
    if (dirPath) {
      handleElectronDirectory(dirPath);
    }
  };

  return (
    <div 
      {...getRootProps()} 
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center justify-center space-y-4">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-12 w-12 text-gray-400"
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
          />
        </svg>
        
        <div className="text-gray-700">
          {isDragActive ? (
            <p className="font-medium">松开鼠标上传图片</p>
          ) : (
            <>
              <p className="font-medium">拖放图片到此处，或点击选择图片</p>
              <p className="text-sm text-gray-500 mt-1">支持JPG、PNG和GIF图片</p>
              {isElectronApp && (
                <div className="mt-4 flex space-x-2">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectFiles();
                    }}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                    disabled={disabled}
                  >
                    选择图片
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectDirectory();
                    }}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    disabled={disabled}
                  >
                    选择文件夹
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageUploader;
