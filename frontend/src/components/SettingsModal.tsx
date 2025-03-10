import React, { useState, useEffect } from 'react';

interface SettingsProps {
  settings: {
    apiBaseUrl: string;
    apiKey: string;
    modelName: string;
    prompt: string;
  };
  backendUrl: string;
  onSave: (settings: SettingsProps['settings'], backendUrl: string) => void;
  onCancel: () => void;
}

const SettingsModal: React.FC<SettingsProps> = ({ settings, backendUrl, onSave, onCancel }) => {
  const [formData, setFormData] = useState({ ...settings });
  const [backendUrlValue, setBackendUrlValue] = useState(backendUrl);

  // 处理表单值变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'backendUrl') {
      setBackendUrlValue(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData, backendUrlValue);
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
              <label htmlFor="backendUrl" className="block text-sm font-medium text-gray-700 mb-1">
                后端服务器URL
              </label>
              <input
                type="text"
                id="backendUrl"
                name="backendUrl"
                value={backendUrlValue}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://localhost:8001"
                required
              />
              <p className="mt-1 text-sm text-gray-500">本地后端服务器的URL，用于处理图片分类请求</p>
            </div>
            
            <div>
              <label htmlFor="apiBaseUrl" className="block text-sm font-medium text-gray-700 mb-1">
                OpenAI API基础URL
              </label>
              <input
                type="text"
                id="apiBaseUrl"
                name="apiBaseUrl"
                value={formData.apiBaseUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://api.openai.com/v1"
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
              <div className="relative">
                <input
                  type="text"
                  id="modelName"
                  name="modelName"
                  value={formData.modelName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="输入模型名称"
                  list="modelOptions"
                  required
                />
                <datalist id="modelOptions">
                  <option value="qwen-vl-plus-latest">通义千问VL</option>
                  <option value="gpt-4-vision-preview">GPT-4 Vision</option>
                  <option value="gpt-4o-2024-05-13">GPT-4o</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                  <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                  <option value="gemini-pro-vision">Gemini Pro Vision</option>
                  <option value="gemini-1.5-pro-latest">Gemini 1.5 Pro</option>
                </datalist>
              </div>
              <p className="mt-1 text-sm text-gray-500">要使用的视觉语言模型，可以选择预设选项或输入自定义模型名称</p>
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
