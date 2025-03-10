const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

// 加载环境变量
dotenv.config();

// 创建应用
const app = express();
const PORT = process.env.PORT || 8001;

// 配置CORS
app.use(cors());
app.use(express.json());

// 确保目录存在
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'classified');
const STATIC_DIR = path.join(__dirname, 'static');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(STATIC_DIR)) fs.mkdirSync(STATIC_DIR, { recursive: true });

// 全局配置
let config = {
  apiBaseUrl: process.env.API_BASE_URL,
  apiKey: process.env.API_KEY,
  modelName: process.env.MODEL_NAME || 'gpt-4-vision-preview',
  classificationPrompt: process.env.CLASSIFICATION_PROMPT || 
    "请分析这张图片属于哪个类别：二次元、生活照片、宠物、工作、表情包。只需回答类别名称，不要解释。",
  validCategories: (process.env.VALID_CATEGORIES || '二次元,生活照片,宠物,工作,表情包,其他').split(',')
};

// OpenAI客户端
let client = null;

// 初始化OpenAI客户端
function initOpenAIClient() {
  if (config.apiKey && config.apiBaseUrl) {
    try {
      client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.apiBaseUrl
      });
      console.log("OpenAI客户端初始化成功");
      return true;
    } catch (error) {
      console.error(`OpenAI客户端初始化失败: ${error.message}`);
      return false;
    }
  } else {
    console.log("未设置API密钥或基础URL，分类功能将在配置后可用");
    return true; // 返回true表示服务可以继续启动
  }
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 只接受图片文件
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('只允许上传图片文件'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  }
});

// 预处理图片：调整大小和压缩
async function preprocessImage(imagePath, maxSize = { width: 1024, height: 1024 }, quality = 85) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // 如果图片尺寸超过最大尺寸，则调整大小
    if (metadata.width > maxSize.width || metadata.height > maxSize.height) {
      await image
        .resize({
          width: Math.min(metadata.width, maxSize.width),
          height: Math.min(metadata.height, maxSize.height),
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: quality })
        .toFile(imagePath + '.processed');
      
      // 替换原文件
      fs.unlinkSync(imagePath);
      fs.renameSync(imagePath + '.processed', imagePath);
    }
    
    return imagePath;
  } catch (error) {
    console.error(`图片预处理失败: ${error.message}`);
    return imagePath;
  }
}

// 获取最接近的预定义类别
function getClosestCategory(responseText) {
  // 清理和标准化响应文本
  const cleanedResponse = responseText.toLowerCase().trim();
  
  // 尝试直接匹配
  for (const category of config.validCategories) {
    if (cleanedResponse.includes(category.toLowerCase())) {
      return category;
    }
  }
  
  // 如果没有匹配，返回"其他"类别
  return "其他";
}

// 使用VLM对图片进行分类
async function classifyImageWithVLM(imagePath) {
  // 检查是否设置了API密钥和基础URL
  if (!config.apiKey || !config.apiBaseUrl) {
    throw new Error("未设置API密钥或基础URL，请先在设置中配置");
  }
  
  // 如果客户端未初始化，尝试初始化
  if (!client) {
    if (!initOpenAIClient()) {
      throw new Error("无法初始化OpenAI客户端，请检查API密钥和基础URL是否有效");
    }
  }
  
  try {
    // 读取图片并转换为base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    console.log(`使用模型 ${config.modelName} 分类图片`);
    
    // 调用OpenAI API
    const response = await client.chat.completions.create({
      model: config.modelName,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: config.classificationPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });
    
    // 解析响应
    const responseText = response.choices[0].message.content.trim();
    console.log(`原始响应: ${responseText}`);
    
    // 获取最接近的类别
    const category = getClosestCategory(responseText);
    
    return {
      category: category,
      confidence: 1.0, // OpenAI API不提供置信度，所以使用默认值
      original_response: responseText,
      file_path: imagePath
    };
  } catch (error) {
    console.error(`分类失败: ${error.message}`);
    throw error;
  }
}

// API路由
// 根路由
app.get('/', (req, res) => {
  res.json({ message: "VLM图像分类器API服务正在运行" });
});

// 对单张图片进行分类
app.post('/classify', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "未提供图片文件" });
    }
    
    console.log(`接收到图片: ${req.file.path}`);
    
    // 预处理图片
    const processedImagePath = await preprocessImage(req.file.path);
    
    // 分类图片
    const result = await classifyImageWithVLM(processedImagePath);
    
    // 确保类别目录存在
    const categoryDir = path.join(OUTPUT_DIR, result.category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }
    
    // 生成唯一文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${path.basename(req.file.path)}`;
    const outputPath = path.join(categoryDir, filename);
    
    // 移动文件到分类目录
    fs.copyFileSync(req.file.path, outputPath);
    fs.unlinkSync(req.file.path);
    
    // 更新结果中的文件路径
    result.file_path = outputPath;
    
    res.json(result);
  } catch (error) {
    console.error(`分类处理错误: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 批量处理多张图片
app.post('/classify-multiple', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "未提供图片文件" });
    }
    
    console.log(`接收到 ${req.files.length} 张图片`);
    
    // 立即返回响应，在后台处理图片
    res.json({ 
      message: `开始处理 ${req.files.length} 张图片`,
      status: "processing",
      total: req.files.length
    });
    
    // 后台处理每张图片
    for (const file of req.files) {
      try {
        // 预处理图片
        const processedImagePath = await preprocessImage(file.path);
        
        // 分类图片
        const result = await classifyImageWithVLM(processedImagePath);
        
        // 确保类别目录存在
        const categoryDir = path.join(OUTPUT_DIR, result.category);
        if (!fs.existsSync(categoryDir)) {
          fs.mkdirSync(categoryDir, { recursive: true });
        }
        
        // 生成唯一文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}-${path.basename(file.path)}`;
        const outputPath = path.join(categoryDir, filename);
        
        // 移动文件到分类目录
        fs.copyFileSync(file.path, outputPath);
        fs.unlinkSync(file.path);
        
        console.log(`图片 ${file.originalname} 分类为 ${result.category}`);
      } catch (error) {
        console.error(`处理图片 ${file.originalname} 失败: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`批量分类处理错误: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取所有可用的分类类别
app.get('/categories', (req, res) => {
  res.json(config.validCategories);
});

// 获取已分类的图片列表
app.get('/classified-images', (req, res) => {
  try {
    const category = req.query.category;
    
    // 如果指定了类别，只返回该类别的图片
    if (category) {
      const categoryDir = path.join(OUTPUT_DIR, category);
      const result = {};
      
      if (fs.existsSync(categoryDir)) {
        const files = fs.readdirSync(categoryDir)
          .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
          })
          .map(file => {
            const filePath = path.join(categoryDir, file);
            const stats = fs.statSync(filePath);
            return {
              filename: file,
              path: `/image/${category}/${file}`,
              url: `/image/${category}/${file}`,
              size: stats.size,
              created: stats.birthtime
            };
          });
        
        // 按时间排序
        files.sort((a, b) => new Date(b.created) - new Date(a.created));
        result[category] = files;
      } else {
        result[category] = [];
      }
      
      res.json(result);
    } else {
      // 返回所有类别的图片
      const result = {};
      
      for (const category of config.validCategories) {
        const categoryDir = path.join(OUTPUT_DIR, category);
        if (fs.existsSync(categoryDir)) {
          const files = fs.readdirSync(categoryDir)
            .filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            })
            .map(file => {
              const filePath = path.join(categoryDir, file);
              const stats = fs.statSync(filePath);
              return {
                filename: file,
                path: `/image/${category}/${file}`,
                url: `/image/${category}/${file}`,
                size: stats.size,
                created: stats.birthtime
              };
            });
          
          // 按时间排序
          files.sort((a, b) => new Date(b.created) - new Date(a.created));
          result[category] = files;
        } else {
          result[category] = [];
        }
      }
      
      res.json(result);
    }
  } catch (error) {
    console.error(`获取分类图片失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取指定类别和文件名的图片
app.get('/image/:category/:filename', (req, res) => {
  try {
    const { category, filename } = req.params;
    const imagePath = path.join(OUTPUT_DIR, category, filename);
    
    if (fs.existsSync(imagePath)) {
      res.sendFile(imagePath);
    } else {
      res.status(404).json({ error: "图片不存在" });
    }
  } catch (error) {
    console.error(`获取图片失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 更新API配置
app.post('/config', (req, res) => {
  try {
    const newConfig = req.body;
    
    // 更新配置
    if (newConfig.apiBaseUrl) config.apiBaseUrl = newConfig.apiBaseUrl;
    if (newConfig.apiKey) config.apiKey = newConfig.apiKey;
    if (newConfig.modelName) config.modelName = newConfig.modelName;
    if (newConfig.classificationPrompt) config.classificationPrompt = newConfig.classificationPrompt;
    if (newConfig.validCategories) config.validCategories = newConfig.validCategories;
    
    // 重新初始化OpenAI客户端
    initOpenAIClient();
    
    res.json({ message: "配置已更新", config });
  } catch (error) {
    console.error(`更新配置失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 将图片从一个类别移动到另一个类别
app.post('/reclassify', (req, res) => {
  try {
    const { filename, sourceCategory, targetCategory } = req.body;
    
    if (!filename || !sourceCategory || !targetCategory) {
      return res.status(400).json({ error: "缺少必要参数" });
    }
    
    const sourcePath = path.join(OUTPUT_DIR, sourceCategory, filename);
    
    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: "源文件不存在" });
    }
    
    // 确保目标目录存在
    const targetDir = path.join(OUTPUT_DIR, targetCategory);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const targetPath = path.join(targetDir, filename);
    
    // 移动文件
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
    
    res.json({
      message: "图片重新分类成功",
      filename,
      sourceCategory,
      targetCategory,
      newPath: `/image/${targetCategory}/${filename}`
    });
  } catch (error) {
    console.error(`重新分类失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 将图片从一个类别移动到另一个类别（与前端兼容的接口）
app.post('/reclassify-image', (req, res) => {
  try {
    // 从查询参数中获取数据
    const { filename, source_category, target_category } = req.query;
    
    if (!filename || !source_category || !target_category) {
      return res.status(400).json({ error: "缺少必要参数" });
    }
    
    const sourcePath = path.join(OUTPUT_DIR, source_category, filename);
    
    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: "源文件不存在" });
    }
    
    // 确保目标目录存在
    const targetDir = path.join(OUTPUT_DIR, target_category);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const targetPath = path.join(targetDir, filename);
    
    // 移动文件
    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
    
    res.json({
      message: `图片已成功从 ${source_category} 移动到 ${target_category}`,
      filename,
      source_category,
      target_category,
      newPath: `/image/${target_category}/${filename}`
    });
  } catch (error) {
    console.error(`重新分类失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 获取当前配置
app.get('/config', (req, res) => {
  // 返回配置，但隐藏API密钥
  const safeConfig = { ...config };
  if (safeConfig.apiKey) {
    safeConfig.apiKey = '******' + safeConfig.apiKey.slice(-4);
  }
  res.json(safeConfig);
});

// 更新配置
app.post('/config', (req, res) => {
  try {
    const newConfig = req.body;
    
    // 更新配置
    if (newConfig.apiKey) config.apiKey = newConfig.apiKey;
    if (newConfig.apiBaseUrl) config.apiBaseUrl = newConfig.apiBaseUrl;
    if (newConfig.modelName) config.modelName = newConfig.modelName;
    
    // 重新初始化OpenAI客户端
    initOpenAIClient();
    
    console.log('配置已更新');
    
    // 返回更新后的配置（隐藏API密钥）
    const safeConfig = { ...config };
    if (safeConfig.apiKey) {
      safeConfig.apiKey = '******' + safeConfig.apiKey.slice(-4);
    }
    
    res.json({
      success: true,
      message: '配置已更新',
      config: safeConfig
    });
  } catch (error) {
    console.error(`更新配置失败: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `更新配置失败: ${error.message}`
    });
  }
});

// 扫描目录，返回所有图片文件的路径
app.get('/scan', (req, res) => {
  try {
    const directoryPath = req.query.path;
    
    if (!directoryPath) {
      return res.status(400).json({ error: "未提供目录路径" });
    }
    
    // 检查路径是否存在
    if (!fs.existsSync(directoryPath)) {
      return res.status(404).json({ error: "目录不存在" });
    }
    
    // 递归扫描目录
    function scanDir(dir) {
      let results = [];
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          // 递归扫描子目录
          results = results.concat(scanDir(filePath));
        } else {
          // 检查是否为图片文件
          const ext = path.extname(file).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            results.push(filePath);
          }
        }
      }
      
      return results;
    }
    
    const imageFiles = scanDir(directoryPath);
    res.json(imageFiles);
  } catch (error) {
    console.error(`扫描目录失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  initOpenAIClient();
});
