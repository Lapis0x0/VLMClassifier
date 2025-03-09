import React from 'react';
import Image from 'next/image';

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

interface ClassificationResultsProps {
  images: ImageItem[];
  onRemoveImage: (id: string) => void;
  isClassifying: boolean;
}

const ClassificationResults: React.FC<ClassificationResultsProps> = ({
  images,
  onRemoveImage,
  isClassifying
}) => {
  // 按类别对图片进行分组
  const groupedImages = images.reduce((groups, image) => {
    const category = image.result?.category || '未分类';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(image);
    return groups;
  }, {} as Record<string, ImageItem[]>);

  // 获取类别列表并按字母排序
  const categories = Object.keys(groupedImages).sort();

  // 获取类别对应的背景颜色
  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      '二次元': 'bg-pink-100 text-pink-800',
      '生活照片': 'bg-blue-100 text-blue-800',
      '宠物': 'bg-green-100 text-green-800',
      '工作': 'bg-purple-100 text-purple-800',
      '表情包': 'bg-yellow-100 text-yellow-800',
      '其他': 'bg-gray-100 text-gray-800',
      '未分类': 'bg-gray-100 text-gray-500',
    };
    
    return colorMap[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      {categories.map(category => (
        <div key={category} className="mb-8">
          <div className="flex items-center mb-4">
            <h3 className="text-lg font-medium mr-3">{category}</h3>
            <span className={`px-2 py-1 rounded-full text-xs ${getCategoryColor(category)}`}>
              {groupedImages[category].length}张
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {groupedImages[category].map(image => (
              <div key={image.id} className="relative group">
                <div className="overflow-hidden rounded-lg shadow-md bg-white">
                  {/* 图片预览 */}
                  <div className="relative aspect-square">
                    <div className="relative w-full h-full">
                      <Image
                        src={image.preview}
                        alt={image.file.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                        priority
                      />
                    </div>
                  </div>
                  
                  {/* 图片信息 */}
                  <div className="p-2">
                    <p className="text-sm text-gray-700 truncate" title={image.file.name}>
                      {image.file.name}
                    </p>
                    {image.result && (
                      <p className="text-xs text-gray-500">
                        置信度: {(image.result.confidence * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                </div>
                
                {/* 删除按钮 */}
                <button
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveImage(image.id)}
                  disabled={isClassifying}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClassificationResults;
