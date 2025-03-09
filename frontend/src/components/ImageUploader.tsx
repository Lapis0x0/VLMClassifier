import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import config from '../config';

interface ImageUploaderProps {
  onImagesAdded: (files: File[]) => void;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesAdded, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // 过滤出图片文件
    const imageFiles = acceptedFiles.filter(file => 
      file.type.startsWith('image/')
    );
    
    if (imageFiles.length > 0) {
      onImagesAdded(imageFiles);
    }
  }, [onImagesAdded]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    disabled,
    noClick: config.isTauri, // 在Tauri应用中禁用点击打开文件选择器，改为使用按钮
    noKeyboard: config.isTauri, // 在Tauri应用中禁用键盘操作
    preventDropOnDocument: false // 允许拖放到整个文档
  });
  
  // 为Tauri应用添加全局拖放事件处理
  useEffect(() => {
    if (config.isTauri && !disabled) {
      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      };
      
      const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
      };
      
      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        if (e.dataTransfer && e.dataTransfer.files) {
          const files = Array.from(e.dataTransfer.files);
          const imageFiles = files.filter(file => file.type.startsWith('image/'));
          if (imageFiles.length > 0) {
            onImagesAdded(imageFiles);
          }
        }
      };
      
      document.addEventListener('dragover', handleDragOver);
      document.addEventListener('dragleave', handleDragLeave);
      document.addEventListener('drop', handleDrop);
      
      return () => {
        document.removeEventListener('dragover', handleDragOver);
        document.removeEventListener('dragleave', handleDragLeave);
        document.removeEventListener('drop', handleDrop);
      };
    }
  }, [config.isTauri, disabled, onImagesAdded]);

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
              <p className="font-medium">{config.isTauri ? '拖放图片到此处' : '拖放图片到此处，或点击选择图片'}</p>
              <p className="text-sm text-gray-500 mt-1">支持JPG、PNG和GIF图片</p>
            </>
          )}
        </div>
        
        {config.isTauri && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            disabled={disabled}
          >
            选择图片
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageUploader;
