import os
import base64
import json
from openai import OpenAI
from PIL import Image
from tqdm import tqdm
import shutil
from dotenv import load_dotenv
import concurrent.futures
from threading import Lock

class ImageClassifier:
    def __init__(self, api_base_url=None, api_key=None, model_name='qwen-vl-plus-latest', 
                 classification_prompt=None, valid_categories=None, max_workers=4):
        # 尝试从环境变量加载默认配置（如果未提供参数）
        if api_base_url is None or api_key is None or classification_prompt is None:
            load_dotenv()
        
        # API配置
        self.api_base_url = api_base_url or os.getenv('API_BASE_URL')
        self.api_key = api_key or os.getenv('API_KEY')
        self.model_name = model_name or os.getenv('MODEL_NAME', 'qwen-vl-plus-latest')
        
        # 分类配置
        self.classification_prompt = classification_prompt or os.getenv('CLASSIFICATION_PROMPT')
        default_categories = '二次元,生活照片,宠物,工作,表情包'
        if valid_categories is None:
            self.valid_categories = os.getenv('VALID_CATEGORIES', default_categories).split(',')
        else:
            self.valid_categories = valid_categories if isinstance(valid_categories, list) else valid_categories.split(',')
        
        # 并发配置
        self.max_workers = max_workers
        
        # 图片处理配置
        self.max_image_size = (1024, 1024)  # 最大图片尺寸
        self.jpeg_quality = 85  # JPEG压缩质量
        
        # 初始化OpenAI客户端（如果有必要的配置）
        self.client = None
        if self.api_base_url and self.api_key:
            try:
                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.api_base_url
                )
            except Exception as e:
                print(f"OpenAI客户端初始化失败: {str(e)}")
        
        # 初始化计数器锁
        self.counter_lock = Lock()
        self.category_counter = {}
        
        print("有效的分类类别：", self.valid_categories)

    def preprocess_image(self, image_path):
        """预处理图片：调整大小和压缩"""
        try:
            # 打开图片
            with Image.open(image_path) as img:
                # 转换为RGB模式（处理RGBA等其他格式）
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # 获取原始大小
                original_size = img.size
                
                # 计算调整后的大小（保持宽高比）
                width, height = original_size
                max_w, max_h = self.max_image_size
                
                if width > max_w or height > max_h:
                    # 计算缩放比例
                    ratio = min(max_w/width, max_h/height)
                    new_size = (int(width*ratio), int(height*ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                
                # 创建临时文件用于存储处理后的图片
                temp_file = os.path.join(os.path.dirname(image_path), f"temp_{os.path.basename(image_path)}")
                
                # 保存压缩后的图片
                img.save(temp_file, 'JPEG', quality=self.jpeg_quality, optimize=True)
                
                # 打印图片大小信息
                original_size_mb = os.path.getsize(image_path) / (1024 * 1024)
                processed_size_mb = os.path.getsize(temp_file) / (1024 * 1024)
                print(f"图片大小: {original_size_mb:.1f}MB -> {processed_size_mb:.1f}MB")
                
                return temp_file
                
        except Exception as e:
            print(f"预处理图片时出错: {str(e)}")
            return image_path

    def encode_image(self, image_path):
        """将图片转换为base64编码"""
        # 首先预处理图片
        processed_image_path = self.preprocess_image(image_path)
        
        try:
            # 读取并编码图片
            with open(processed_image_path, 'rb') as image_file:
                encoded = base64.b64encode(image_file.read()).decode('utf-8')
            
            # 如果是临时文件，则删除
            if processed_image_path != image_path:
                os.remove(processed_image_path)
            
            return encoded
        except Exception as e:
            print(f"编码图片时出错: {str(e)}")
            # 确保清理临时文件
            if processed_image_path != image_path and os.path.exists(processed_image_path):
                os.remove(processed_image_path)
            raise

    def get_closest_category(self, response_text):
        """获取最接近的预定义类别"""
        response_text = response_text.lower()
        # 创建响应文本与预定义类别的映射关系
        category_mapping = {
            '二次元': ['二次元', '动漫', '漫画', '插画', 'anime', '动画'],
            '生活照片': ['生活', '日常', '照片', '风景', '人物', '自拍', '食物'],
            '宠物': ['宠物', '猫', '狗', '喵', '汪', 'cat', 'dog'],
            '工作': ['工作', '办公', '会议', '文档', '代码', '笔记', '项目'],
            '表情包': ['表情包', '表情', 'meme', 'memes', '梗图', '搞笑', '笑话', '梗']
        }
        
        # 遍历响应文本中的每个词
        for word in response_text.split():
            for category, keywords in category_mapping.items():
                if any(keyword in word for keyword in keywords):
                    return category
        
        # 如果没有找到匹配的类别，返回"其他"
        return "其他"

    def classify_image(self, image_path):
        """使用VL API对单张图片进行分类"""
        try:
            # 验证必要的配置
            if not all([self.api_base_url, self.api_key, self.classification_prompt]):
                raise ValueError("缺少必要的配置：API_BASE_URL, API_KEY, CLASSIFICATION_PROMPT")
                
            # 如果客户端未初始化，则初始化
            if self.client is None:
                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.api_base_url
                )
            
            # 读取并编码图片
            base64_image = self.encode_image(image_path)
            
            # 准备API请求
            completion = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            },
                            {
                                "type": "text",
                                "text": self.classification_prompt
                            }
                        ]
                    }
                ]
            )
            
            # 从 API响应中提取类别并匹配到预定义类别
            response_text = completion.choices[0].message.content
            category = self.get_closest_category(response_text)
            print(f"图片 {os.path.basename(image_path)} 的原始响应: {response_text}")
            print(f"匹配到的类别: {category}")
            return category
                
        except Exception as e:
            print(f"处理图片 {image_path} 时出错: {str(e)}")
            return "其他"

    def process_single_image(self, args):
        """处理单张图片（用于并发处理）"""
        image_file, input_dir, output_dir, index, total = args
        image_path = os.path.join(input_dir, image_file)
        
        try:
            # 获取分类
            with self.counter_lock:
                print(f"\n正在处理: {image_file} ({index + 1}/{total})")
            
            category = self.classify_image(image_path)
            
            # 更新计数器
            with self.counter_lock:
                self.category_counter[category] = self.category_counter.get(category, 0) + 1
            
            # 复制文件
            category_dir = os.path.join(output_dir, category)
            shutil.copy2(image_path, os.path.join(category_dir, image_file))
            
            return True
        except Exception as e:
            print(f"\n处理图片 {image_file} 时出错: {str(e)}")
            return False

    def clean_input_directory(self, input_dir):
        """清空输入文件夹，保留.gitkeep文件"""
        print("\n4. 清理输入文件夹...")
        try:
            # 获取所有文件
            files = os.listdir(input_dir)
            for file in files:
                if file != '.gitkeep':  # 保留.gitkeep文件
                    file_path = os.path.join(input_dir, file)
                    if os.path.isfile(file_path):
                        os.remove(file_path)
            print("✓ 输入文件夹已清空")
        except Exception as e:
            print(f"清理输入文件夹时出错: {str(e)}")

    def organize_directory(self, input_dir, output_dir):
        """整理图片目录"""
        print("\n=== 开始图片分类 ===")
        
        # 确保输出目录存在
        print("\n1. 准备目录...")
        os.makedirs(output_dir, exist_ok=True)
        
        # 为每个预定义类别创建目录
        for category in self.valid_categories + ['其他']:
            os.makedirs(os.path.join(output_dir, category), exist_ok=True)
        print("✓ 目录准备完成")
        
        # 获取所有图片文件
        print("\n2. 扫描图片文件...")
        image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp')
        image_files = [
            f for f in os.listdir(input_dir) 
            if os.path.isfile(os.path.join(input_dir, f)) and 
            f.lower().endswith(image_extensions)
        ]
        
        total_images = len(image_files)
        if total_images == 0:
            print("❌ 未找到任何图片文件！")
            return
        print(f"✓ 找到 {total_images} 张图片待处理")
        
        # 初始化计数器
        self.category_counter = {category: 0 for category in self.valid_categories + ['其他']}
        
        # 准备并发处理参数
        process_args = [
            (image_file, input_dir, output_dir, index, total_images)
            for index, image_file in enumerate(image_files)
        ]
        
        # 使用线程池进行并发处理
        print(f"\n3. 开始处理图片... (使用 {self.max_workers} 个并发线程)")
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self.process_single_image, args) for args in process_args]
            
            # 使用tqdm显示总体进度
            for _ in tqdm(
                concurrent.futures.as_completed(futures),
                total=len(futures),
                desc="处理进度",
                unit="张"
            ):
                pass
        
        # 打印分类统计
        print("\n=== 分类完成 ===")
        print("\n分类统计:")
        print("-" * 30)
        for category in self.valid_categories + ['其他']:
            count = self.category_counter[category]
            percentage = (count / total_images) * 100
            print(f"{category}: {count} 张图片 ({percentage:.1f}%)")
        print("-" * 30)
        print(f"总计: {total_images} 张图片")
        
        # 如果配置为true，清空输入文件夹
        if os.getenv('CLEAN_INPUT_AFTER_PROCESS', 'true').lower() == 'true':
            self.clean_input_directory(input_dir)
        
        print("\n✓ 所有图片已完成分类！")
        print(f"✓ 分类结果保存在: {output_dir}")

def main():
    # 使用示例
    classifier = ImageClassifier()
    
    # 获取目录配置
    input_dir = os.getenv('INPUT_DIR', 'images/input')
    output_dir = os.getenv('OUTPUT_DIR', 'images/output')
    
    if not os.path.exists(input_dir):
        print("输入目录不存在！")
        return
        
    classifier.organize_directory(input_dir, output_dir)

if __name__ == "__main__":
    main()
