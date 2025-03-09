import React, { useState, useEffect } from 'react';

interface SettingsProps {
  settings: {
    apiBaseUrl: string;
    apiKey: string;
    modelName: string;
    prompt: string;
  };
  onSave: (settings: SettingsProps['settings']) => void;
  onCancel: () => void;
}

const SettingsModal: React.FC<SettingsProps> = ({ settings, onSave, onCancel }) => {
  const [formData, setFormData] = useState({ ...settings });

  // 处理表单值变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  // 阻止点击模态框内容时冒泡到背景
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // 当按下ESC键时关闭模态框
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={handleModalClick}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">API设置</h2>
          <button 
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="apiBaseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                API基础URL
              </label>
              <input
                type="text"
                id="apiBaseUrl"
                name="apiBaseUrl"
                value={formData.apiBaseUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://api.example.com/v1"
                required
              />
              <p className="mt-1 text-sm text-gray-500">视觉语言模型API的基础URL</p>
            </div>
            
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
                API密钥
              </label>
              <input
                type="password"
                id="apiKey"
                name="apiKey"
                value={formData.apiKey}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                required
              />
              <p className="mt-1 text-sm text-gray-500">用于访问API的密钥</p>
            </div>
            
            <div>
              <label htmlFor="modelName" className="block text-sm font-medium text-gray-700 mb-1">
                模型名称
              </label>
              <select
                id="modelName"
                name="modelName"
                value={formData.modelName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="qwen-vl-plus-latest">通义千问VL</option>
                <option value="gpt-4-vision-preview">GPT-4 Vision</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                <option value="gemini-pro-vision">Gemini Pro Vision</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">要使用的视觉语言模型</p>
            </div>
            
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-1">
                分类提示词
              </label>
              <textarea
                id="prompt"
                name="prompt"
                value={formData.prompt}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="请分析这张图片属于哪个类别..."
                required
              />
              <p className="mt-1 text-sm text-gray-500">用于指导模型进行分类的提示词</p>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;
