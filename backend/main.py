import os
import base64
import json
import shutil
import uuid
from typing import List, Dict, Optional
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
from PIL import Image
from io import BytesIO
from openai import OpenAI
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 创建应用
app = FastAPI(title="VLM Image Classifier API", description="使用视觉语言模型对图片进行分类的API服务")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该设置为特定的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保目录存在
UPLOAD_DIR = Path("./uploads")
OUTPUT_DIR = Path("./classified")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

# 数据模型
class ClassificationResult(BaseModel):
    category: str
    confidence: float = 1.0
    original_response: str
    file_path: Optional[str] = None

class ConfigModel(BaseModel):
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: str = 'qwen-vl-plus-latest'
    classification_prompt: Optional[str] = None
    valid_categories: List[str] = ['二次元', '生活照片', '宠物', '工作', '表情包', '其他']

# 全局配置
config = ConfigModel(
    api_base_url=os.getenv('API_BASE_URL'),
    api_key=os.getenv('API_KEY'),
    model_name=os.getenv('MODEL_NAME', 'qwen-vl-plus-latest'),
    classification_prompt=os.getenv('CLASSIFICATION_PROMPT', 
                              "请分析这张图片属于哪个类别：二次元、生活照片、宠物、工作、表情包。只需回答类别名称，不要解释。"),
    valid_categories=os.getenv('VALID_CATEGORIES', '二次元,生活照片,宠物,工作,表情包,其他').split(',')
)

# OpenAI客户端
client = None

def init_openai_client():
    """初始化OpenAI客户端"""
    global client
    print(f"尝试初始化OpenAI客户端，API基础URL: {config.api_base_url}, API密钥是否存在: {bool(config.api_key)}")
    if config.api_base_url and config.api_key:
        try:
            # 尝试获取OpenAI库的版本
            import openai
            print(f"OpenAI库版本: {openai.__version__}")
            
            # 尝试使用低级别的API初始化客户端
            import os
            # 暂时移除代理设置
            http_proxy = os.environ.pop('HTTP_PROXY', None)
            https_proxy = os.environ.pop('HTTPS_PROXY', None)
            no_proxy = os.environ.pop('NO_PROXY', None)
            
            try:
                from openai._client import OpenAI as RawOpenAI
                print("使用基础OpenAI客户端类")
                client = RawOpenAI(
                    api_key=config.api_key,
                    base_url=config.api_base_url
                )
                print("OpenAI客户端初始化成功")
                return True
            except Exception as raw_error:
                print(f"使用基础客户端类初始化失败: {str(raw_error)}")
                
                # 尝试使用自定义HTTP客户端
                try:
                    import httpx
                    from openai import OpenAI as OpenAIClient
                    
                    # 创建不使用代理的HTTP客户端
                    http_client = httpx.Client()
                    
                    # 使用自定义HTTP客户端初始化OpenAI
                    client = OpenAIClient(
                        api_key=config.api_key,
                        base_url=config.api_base_url,
                        http_client=http_client
                    )
                    print("使用自定义HTTP客户端初始化OpenAI成功")
                    return True
                except Exception as httpx_error:
                    print(f"使用自定义HTTP客户端初始化失败: {str(httpx_error)}")
            
            # 恢复代理设置
            if http_proxy: os.environ['HTTP_PROXY'] = http_proxy
            if https_proxy: os.environ['HTTPS_PROXY'] = https_proxy
            if no_proxy: os.environ['NO_PROXY'] = no_proxy
            
        except Exception as e:
            print(f"OpenAI客户端初始化失败: {str(e)}")
            import traceback
            traceback.print_exc()
    else:
        print("无法初始化OpenAI客户端：API基础URL或API密钥未设置")
    return False

def preprocess_image(image: Image.Image, max_size=(1024, 1024), quality=85):
    """预处理图片：调整大小和压缩"""
    # 转换为RGB模式（处理RGBA等其他格式）
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # 获取原始大小
    original_size = image.size
    
    # 计算调整后的大小（保持宽高比）
    width, height = original_size
    max_w, max_h = max_size
    
    if width > max_w or height > max_h:
        # 计算缩放比例
        ratio = min(max_w/width, max_h/height)
        new_size = (int(width*ratio), int(height*ratio))
        image = image.resize(new_size, Image.LANCZOS)
    
    # 返回处理后的图片
    img_byte_arr = BytesIO()
    image.save(img_byte_arr, format='JPEG', quality=quality, optimize=True)
    img_byte_arr.seek(0)
    
    return img_byte_arr

def get_closest_category(response_text: str) -> str:
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

async def classify_image_with_vlm(image_data: bytes) -> ClassificationResult:
    """使用VLM对图片进行分类"""
    global client
    
    # 确保客户端初始化
    if client is None:
        print("客户端未初始化，尝试初始化...")
        if not init_openai_client():
            error_msg = "无法初始化API客户端，请检查配置"
            print(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
    
    try:
        # 编码图片
        print("开始处理图片数据...")
        base64_image = base64.b64encode(image_data).decode('utf-8')
        print(f"图片数据大小: {len(base64_image)} 字节")
        
        # 调用API
        print(f"准备调用 {config.model_name} 模型...")
        try:
            completion = client.chat.completions.create(
                model=config.model_name,
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
                                "text": config.classification_prompt
                            }
                        ]
                    }
                ]
            )
            print("模型调用成功")
        except Exception as api_error:
            print(f"调用API时出错: {str(api_error)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"调用视觉语言模型API失败: {str(api_error)}")
        
        # 解析响应
        try:
            response_text = completion.choices[0].message.content
            print(f"模型原始响应: {response_text}")
            category = get_closest_category(response_text)
            print(f"匹配的类别: {category}")
            
            return ClassificationResult(
                category=category,
                original_response=response_text
            )
        except Exception as parse_error:
            print(f"解析模型响应时出错: {str(parse_error)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"解析模型响应失败: {str(parse_error)}")
        
    except HTTPException:
        # 直接重新抛出已经格式化的HTTP异常
        raise
    except Exception as e:
        print(f"分类过程中出错: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"分类失败: {str(e)}")

# API路由
@app.get("/")
async def root():
    return {"message": "欢迎使用VLM图片分类API服务"}

@app.post("/classify")
async def classify_image(file: UploadFile = File(...), request: Request = None):
    """对单张图片进行分类"""
    # 打印请求信息
    print(f"\n\n=== 新的分类请求 ===\n文件名: {file.filename}\n文件类型: {file.content_type}")
    if request:
        print(f"请求头部: {dict(request.headers)}")
    
    # 验证文件类型
    if not file.content_type.startswith('image/'):
        error_msg = "请上传图片文件"
        print(f"错误: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    
    try:
        # 读取图片
        print("读取图片数据...")
        image_data = await file.read()
        print(f"读取到图片数据，大小: {len(image_data)} 字节")
        
        try:
            # 打开图片
            image = Image.open(BytesIO(image_data))
            print(f"成功打开图片，格式: {image.format}, 大小: {image.size}, 模式: {image.mode}")
        except Exception as img_error:
            print(f"打开图片时出错: {str(img_error)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=400, detail=f"无法打开图片文件: {str(img_error)}")
        
        try:
            # 预处理图片
            print("预处理图片...")
            processed_image_data = preprocess_image(image).getvalue()
            print(f"预处理后的图片大小: {len(processed_image_data)} 字节")
        except Exception as preprocess_error:
            print(f"预处理图片时出错: {str(preprocess_error)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"预处理图片失败: {str(preprocess_error)}")
        
        # 分类
        print("开始调用视觉语言模型进行分类...")
        result = await classify_image_with_vlm(processed_image_data)
        print("分类成功，返回结果")
        
        # 保存分类后的图片到对应类别文件夹
        try:
            # 确保分类目录存在
            category_dir = OUTPUT_DIR / result.category
            category_dir.mkdir(exist_ok=True)
            
            # 生成唯一文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{uuid.uuid4().hex[:8]}_{file.filename}"
            output_path = category_dir / filename
            
            # 保存原始图片
            with open(output_path, "wb") as f:
                f.write(image_data)
            
            print(f"图片已保存到: {output_path}")
            
            # 将保存路径添加到结果中
            result.file_path = str(output_path)
        except Exception as save_error:
            print(f"保存图片时出错: {str(save_error)}")
            import traceback
            traceback.print_exc()
            # 不中断流程，继续返回分类结果
        
        return result
    except HTTPException:
        # 直接重新抛出已经格式化的HTTP异常
        raise
    except Exception as e:
        print(f"处理图片时出错: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"处理图片时出错: {str(e)}")

@app.post("/classify-multiple")
async def classify_multiple_images(files: List[UploadFile] = File(...), background_tasks: BackgroundTasks = None):
    """批量处理多张图片"""
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一张图片")
    
    results = {}
    errors = {}
    
    for file in files:
        if not file.content_type.startswith('image/'):
            errors[file.filename] = "不是有效的图片文件"
            continue
        
        try:
            # 读取图片
            image_data = await file.read()
            image = Image.open(BytesIO(image_data))
            
            # 预处理图片
            processed_image_data = preprocess_image(image).getvalue()
            
            # 分类
            result = await classify_image_with_vlm(processed_image_data)
            results[file.filename] = result
            
            # 保存文件到对应目录（可选的后台任务）
            if background_tasks:
                dest_dir = OUTPUT_DIR / result.category
                dest_dir.mkdir(exist_ok=True)
                
                # 生成唯一文件名
                unique_filename = f"{uuid.uuid4()}_{file.filename}"
                destination = dest_dir / unique_filename
                
                # 复制到目标目录
                background_tasks.add_task(
                    lambda: Image.open(BytesIO(image_data)).save(destination)
                )
                
        except Exception as e:
            errors[file.filename] = str(e)
    
    return {"results": results, "errors": errors}

@app.get("/categories")
async def get_categories():
    """获取所有可用的分类类别"""
    return {"categories": config.valid_categories}

@app.get("/classified-images")
async def get_classified_images(category: Optional[str] = None):
    """获取已分类的图片列表
    
    如果指定了category参数，则只返回该类别的图片
    否则返回所有类别的图片
    """
    result = {}
    
    # 确定要扫描的类别目录
    if category and category in config.valid_categories:
        categories_to_scan = [category]
    else:
        categories_to_scan = config.valid_categories
    
    # 扫描每个类别目录
    for cat in categories_to_scan:
        cat_dir = OUTPUT_DIR / cat
        if not cat_dir.exists():
            continue
            
        # 获取该类别下的所有图片
        image_files = []
        for img_path in cat_dir.glob("*"):
            if img_path.is_file() and img_path.suffix.lower() in [".jpg", ".jpeg", ".png", ".gif", ".bmp"]:
                image_files.append({
                    "filename": img_path.name,
                    "path": str(img_path),
                    "url": f"/images/{cat}/{img_path.name}",
                    "size": img_path.stat().st_size,
                    "created": datetime.fromtimestamp(img_path.stat().st_ctime).isoformat()
                })
        
        # 按创建时间排序（最新的在前）
        image_files.sort(key=lambda x: x["created"], reverse=True)
        result[cat] = image_files
    
    return result

@app.get("/images/{category}/{filename}")
async def get_image(category: str, filename: str):
    """获取指定类别和文件名的图片"""
    if category not in config.valid_categories:
        raise HTTPException(status_code=404, detail=f"类别 '{category}' 不存在")
        
    file_path = OUTPUT_DIR / category / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail=f"文件 '{filename}' 不存在")
        
    return FileResponse(file_path)

@app.post("/config")
async def update_config(new_config: ConfigModel):
    """更新API配置"""
    global config, client
    
    # 更新配置
    config = new_config
    
    # 重新初始化客户端
    client = None
    init_success = init_openai_client()
    
    return {"success": init_success, "config": config}

@app.post("/reclassify-image")
async def reclassify_image(filename: str, source_category: str, target_category: str):
    """将图片从一个类别移动到另一个类别"""
    # 验证类别是否有效
    if source_category not in config.valid_categories:
        raise HTTPException(status_code=400, detail=f"源类别 '{source_category}' 不存在")
    if target_category not in config.valid_categories:
        raise HTTPException(status_code=400, detail=f"目标类别 '{target_category}' 不存在")
    
    # 构建源文件和目标文件路径
    source_path = OUTPUT_DIR / source_category / filename
    target_dir = OUTPUT_DIR / target_category
    target_path = target_dir / filename
    
    # 检查源文件是否存在
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail=f"文件 '{filename}' 在类别 '{source_category}' 中不存在")
    
    # 确保目标目录存在
    target_dir.mkdir(exist_ok=True)
    
    try:
        # 如果目标文件已存在，生成一个新的文件名
        if target_path.exists():
            # 提取原始文件名和扩展名
            name_parts = filename.rsplit('.', 1)
            base_name = name_parts[0]
            extension = name_parts[1] if len(name_parts) > 1 else ''
            
            # 生成新文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            new_filename = f"{base_name}_{timestamp}.{extension}" if extension else f"{base_name}_{timestamp}"
            target_path = target_dir / new_filename
        
        # 移动文件
        shutil.move(str(source_path), str(target_path))
        
        return {
            "success": True,
            "message": f"图片已从 '{source_category}' 移动到 '{target_category}'",
            "old_path": str(source_path),
            "new_path": str(target_path),
            "new_url": f"/images/{target_category}/{target_path.name}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"移动图片时出错: {str(e)}")

@app.get("/config")
async def get_config():
    """获取当前配置"""
    # 不返回敏感信息
    safe_config = config.dict()
    if 'api_key' in safe_config and safe_config['api_key']:
        safe_config['api_key'] = "*" * 10
    
    return safe_config

# 提供静态文件服务（用于测试）
# 确保static目录存在
static_dir = Path("./static")
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 启动应用时初始化客户端
@app.on_event("startup")
async def startup_event():
    init_openai_client()
    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
