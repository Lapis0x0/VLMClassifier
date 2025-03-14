import os
import sys
import threading
import shutil
import json
from pathlib import Path
from PIL import Image
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout,
                             QHBoxLayout, QPushButton, QLabel, QScrollArea,
                             QFileDialog, QMessageBox, QFrame, QSizePolicy,
                             QGraphicsDropShadowEffect, QProgressBar, QLayout,
                             QLineEdit, QTextEdit, QTabWidget, QComboBox, QFormLayout,
                             QGroupBox, QDialog, QDialogButtonBox, QSplitter,
                             QToolButton, QSpacerItem)
from PyQt5.QtCore import QRect, QSize, QPoint
from PyQt5.QtCore import Qt, QSize, QThread, pyqtSignal, QMimeData, QPoint, QSettings, QTimer
from PyQt5.QtGui import QPixmap, QDragEnterEvent, QDropEvent, QPalette, QColor, QFont
from image_classifier import ImageClassifier
from dotenv import load_dotenv

class ClassificationThread(QThread):
    """处理图片分类的后台线程"""
    progress_signal = pyqtSignal(str)
    progress_value = pyqtSignal(int)  # 新增进度值信号
    finished_signal = pyqtSignal()
    error_signal = pyqtSignal(str)

    def __init__(self, classifier, images, output_dir):
        super().__init__()
        self.classifier = classifier
        self.images = images
        self.output_dir = output_dir
        self.is_running = True

    def run(self):
        try:
            total = len(self.images)
            for i, image_path in enumerate(self.images, 1):
                if not self.is_running:
                    break
                
                # 发送进度信息
                progress = int((i / total) * 100)
                self.progress_value.emit(progress)
                self.progress_signal.emit(f'正在处理 {i}/{total}: {os.path.basename(image_path)}')
                
                # 获取分类结果
                category = self.classifier.classify_image(image_path)
                
                # 移动文件到对应目录
                dest_dir = os.path.join(self.output_dir, category)
                os.makedirs(dest_dir, exist_ok=True)
                shutil.copy2(image_path, dest_dir)
            
            self.progress_value.emit(100)  # 确保进度条到达100%
            self.finished_signal.emit()
        except Exception as e:
            self.error_signal.emit(str(e))

    def stop(self):
        self.is_running = False


class ImagePreviewWidget(QWidget):
    """图片预览组件"""
    removed = pyqtSignal(str)  # 发送被删除图片的路径
    
    def __init__(self, image_path, size=QSize(200, 200)):
        super().__init__()
        self.image_path = image_path
        self.size = size
        self.setup_ui()
        self.apply_styles()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(8)

        # 创建容器frame
        self.frame = QFrame()
        self.frame.setObjectName("previewFrame")
        frame_layout = QVBoxLayout(self.frame)
        frame_layout.setContentsMargins(8, 8, 8, 8)
        
        # 添加删除按钮
        delete_btn = QPushButton("✕")
        delete_btn.setObjectName("deleteButton")
        delete_btn.setCursor(Qt.PointingHandCursor)
        delete_btn.clicked.connect(self.remove_self)
        delete_btn.setFixedSize(24, 24)
        delete_btn_layout = QHBoxLayout()
        delete_btn_layout.addStretch()
        delete_btn_layout.addWidget(delete_btn)
        frame_layout.addLayout(delete_btn_layout)

        # 图片标签
        self.image_label = QLabel()
        self.image_label.setAlignment(Qt.AlignCenter)
        self.image_label.setObjectName("imageLabel")
        self.load_image()

        # 文件名标签
        self.name_label = QLabel(os.path.basename(self.image_path))
        self.name_label.setAlignment(Qt.AlignCenter)
        self.name_label.setWordWrap(True)
        self.name_label.setObjectName("nameLabel")

        frame_layout.addWidget(self.image_label)
        frame_layout.addWidget(self.name_label)
        layout.addWidget(self.frame)

        # 添加阴影效果
        shadow = QGraphicsDropShadowEffect(self)
        shadow.setBlurRadius(15)
        shadow.setColor(QColor(0, 0, 0, 30))
        shadow.setOffset(0, 2)
        self.frame.setGraphicsEffect(shadow)

    def apply_styles(self):
        self.frame.setStyleSheet("""
            #previewFrame {
                background-color: white;
                border-radius: 10px;
                border: 1px solid #e0e0e0;
            }
            #nameLabel {
                color: #333;
                font-size: 12px;
                margin-top: 5px;
            }
            #deleteButton {
                background-color: #dc3545;
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                padding: 0px;
            }
            #deleteButton:hover {
                background-color: #bb2d3b;
            }
        """)
        
    def remove_self(self):
        """删除自身组件"""
        self.removed.emit(self.image_path)
        self.deleteLater()

    def load_image(self):
        pixmap = QPixmap(self.image_path)
        scaled_pixmap = pixmap.scaled(self.size, Qt.KeepAspectRatio, Qt.SmoothTransformation)
        self.image_label.setPixmap(scaled_pixmap)


class FlowLayout(QLayout):
    """流式布局，可以自动换行的网格布局"""
    def __init__(self, parent=None, margin=0, spacing=-1):
        super().__init__(parent)
        self.itemList = []
        self.margin = margin
        self.spacing = spacing

    def addItem(self, item):
        self.itemList.append(item)

    def count(self):
        return len(self.itemList)

    def itemAt(self, index):
        if 0 <= index < len(self.itemList):
            return self.itemList[index]
        return None

    def takeAt(self, index):
        if 0 <= index < len(self.itemList):
            return self.itemList.pop(index)
        return None

    def expandingDirections(self):
        return Qt.Orientations()

    def hasHeightForWidth(self):
        return True

    def heightForWidth(self, width):
        height = self.doLayout(QRect(0, 0, width, 0), True)
        return height

    def setGeometry(self, rect):
        super().setGeometry(rect)
        self.doLayout(rect, False)

    def sizeHint(self):
        return self.minimumSize()

    def minimumSize(self):
        size = QSize()
        for item in self.itemList:
            size = size.expandedTo(item.minimumSize())
        size += QSize(2 * self.margin, 2 * self.margin)
        return size

    def doLayout(self, rect, testOnly):
        x = rect.x() + self.margin
        y = rect.y() + self.margin
        lineHeight = 0
        spaceX = self.spacing
        spaceY = self.spacing

        for item in self.itemList:
            nextX = x + item.sizeHint().width() + spaceX
            if nextX - spaceX > rect.right() and lineHeight > 0:
                x = rect.x() + self.margin
                y = y + lineHeight + spaceY
                nextX = x + item.sizeHint().width() + spaceX
                lineHeight = 0

            if not testOnly:
                item.setGeometry(QRect(QPoint(x, y), item.sizeHint()))

            x = nextX
            lineHeight = max(lineHeight, item.sizeHint().height())

        return y + lineHeight - rect.y() + self.margin

class DropArea(QScrollArea):
    """支持拖放的图片预览区域"""
    files_dropped = pyqtSignal(list)

    def __init__(self):
        super().__init__()
        self.setAcceptDrops(True)
        self.setWidgetResizable(True)
        self.setObjectName("dropArea")
        
        # 创建内容容器
        self.content = QWidget()
        self.content.setObjectName("dropAreaContent")
        self.setWidget(self.content)
        
        # 使用流式布局来展示图片
        self.layout = FlowLayout(self.content, margin=20, spacing=15)
        
        # 提示标签
        self.hint_label = QLabel("拖放图片或文件夹到此处，或点击选择图片按钮")
        self.hint_label.setAlignment(Qt.AlignCenter)
        self.hint_label.setObjectName("hintLabel")
        self.layout.addWidget(self.hint_label)

        self.apply_styles()

    def apply_styles(self):
        self.setStyleSheet("""
            QScrollArea#dropArea {
                background-color: #f8f9fa;
                border: 2px dashed #dee2e6;
                border-radius: 12px;
            }
            QWidget#dropAreaContent {
                background-color: transparent;
                padding: 10px;
            }
            QLabel#hintLabel {
                color: #6c757d;
                font-size: 16px;
                padding: 40px;
            }
        """)

    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls():
            self.setStyleSheet("""
                QScrollArea#dropArea {
                    background-color: #e9ecef;
                    border: 2px dashed #0d6efd;
                    border-radius: 12px;
                }
                QWidget#dropAreaContent {
                    background-color: transparent;
                }
                QLabel#hintLabel {
                    color: #0d6efd;
                    font-size: 16px;
                    padding: 40px;
                }
            """)
            event.acceptProposedAction()

    def dragLeaveEvent(self, event):
        self.apply_styles()

    def dragEnterEvent(self, event: QDragEnterEvent):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def get_image_files(self, path):
        """递归获取文件夹中的所有图片文件"""
        image_files = []
        if os.path.isfile(path):
            if path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                image_files.append(path)
        elif os.path.isdir(path):
            for root, _, files in os.walk(path):
                for file in files:
                    file_path = os.path.join(root, file)
                    if file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                        image_files.append(file_path)
        return image_files

    def dropEvent(self, event: QDropEvent):
        dropped_paths = [url.toLocalFile() for url in event.mimeData().urls()]
        files = []
        for path in dropped_paths:
            files.extend(self.get_image_files(path))
        if files:
            self.files_dropped.emit(files)


class ConfigDialog(QDialog):
    """配置对话框，用于设置API和模型参数"""
    def __init__(self, parent=None, config=None):
        super().__init__(parent)
        self.config = config or {}
        self.setWindowTitle("配置设置")
        self.setMinimumWidth(500)
        self.setup_ui()
        self.load_config()
    
    def setup_ui(self):
        layout = QVBoxLayout(self)
        
        # 创建表单布局
        form_layout = QFormLayout()
        
        # API配置组
        api_group = QGroupBox("API配置")
        api_layout = QFormLayout()
        
        self.api_base_url = QLineEdit()
        self.api_key = QLineEdit()
        self.model_name = QLineEdit()
        
        api_layout.addRow("API基础URL:", self.api_base_url)
        api_layout.addRow("API密钥:", self.api_key)
        api_layout.addRow("模型名称:", self.model_name)
        
        api_group.setLayout(api_layout)
        layout.addWidget(api_group)
        
        # 分类配置组
        class_group = QGroupBox("分类配置")
        class_layout = QFormLayout()
        
        self.classification_prompt = QTextEdit()
        self.classification_prompt.setMinimumHeight(100)
        self.valid_categories = QLineEdit()
        
        class_layout.addRow("分类提示词:", self.classification_prompt)
        class_layout.addRow("有效类别(逗号分隔):", self.valid_categories)
        
        class_group.setLayout(class_layout)
        layout.addWidget(class_group)
        
        # 性能配置组
        perf_group = QGroupBox("性能配置")
        perf_layout = QFormLayout()
        
        self.max_workers = QComboBox()
        for i in range(1, 9):
            self.max_workers.addItem(str(i))
        
        perf_layout.addRow("最大并发数:", self.max_workers)
        
        perf_group.setLayout(perf_layout)
        layout.addWidget(perf_group)
        
        # 按钮
        button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def load_config(self):
        """从配置加载设置"""
        self.api_base_url.setText(self.config.get('api_base_url', ''))
        self.api_key.setText(self.config.get('api_key', ''))
        self.model_name.setText(self.config.get('model_name', 'qwen-vl-plus-latest'))
        self.classification_prompt.setText(self.config.get('classification_prompt', ''))
        self.valid_categories.setText(','.join(self.config.get('valid_categories', ['二次元', '生活照片', '宠物', '工作', '表情包'])))
        self.max_workers.setCurrentText(str(self.config.get('max_workers', 4)))
    
    def get_config(self):
        """获取配置数据"""
        return {
            'api_base_url': self.api_base_url.text().strip(),
            'api_key': self.api_key.text().strip(),
            'model_name': self.model_name.text().strip(),
            'classification_prompt': self.classification_prompt.toPlainText().strip(),
            'valid_categories': [cat.strip() for cat in self.valid_categories.text().split(',') if cat.strip()],
            'max_workers': int(self.max_workers.currentText())
        }


class ImageClassifierApp(QMainWindow):
    """图片分类器GUI应用"""
    def __init__(self):
        super().__init__()
        self.images = []
        self.classification_thread = None
        
        # 加载配置
        self.settings = QSettings("VLMClassifier", "ImageClassifier")
        self.config = self.load_config()
        
        # 初始化分类器相关变量
        self.classifier = None
        # 设置默认分类类别
        default_categories = self.config.get('valid_categories', ['二次元', '生活照片', '宠物', '工作', '表情包'])
        self.categories = default_categories + ["其他"]

        # 确保目录结构
        self.ensure_directories()
        
        # 设置界面
        self.setup_ui()
        
        # 应用程序启动后，检查API密钥是否为空，如果为空则自动打开配置面板
        QTimer.singleShot(500, self.check_api_key_on_startup)
    
    def load_config(self):
        """从QSettings加载配置"""
        config = {}
        
        # 尝试从QSettings加载
        if self.settings.contains("config"):
            config_str = self.settings.value("config")
            try:
                config = json.loads(config_str)
                
                # 注意：我们不再在这里清空API密钥和基础URL
                    
                # 注意：我们不再在这里清空API密钥和基础URL
                # 这样用户的配置可以正常保存和加载
                # 我们只在初始打包时确保.env文件中的敏感信息不被包含
            except:
                pass
        
        # 如果QSettings中没有配置，使用预设的默认值
        if not config:
            # 默认配置
            config = {
                'api_base_url': 'https://dashscope.aliyuncs.com/compatible-mode/v1',  # 预设阿里云通义千问API地址
                'api_key': '',  # 默认为空，需要用户填写
                'model_name': 'qwen-vl-plus-latest',  # 默认模型名称
                'classification_prompt': '请分析这张图片属于哪一类别，只输出类别名称，不要其他解释。类别必须严格从以下选项中选择一个：{categories}',  # 默认提示词
                'valid_categories': '二次元,生活照片,宠物,工作,表情包'.split(','),  # 默认分类类别
                'max_workers': 4  # 默认并发数
            }
            
            # 在打包的应用程序中，我们不使用dotenv模块和.env文件
            # 这里保留代码仅用于开发环境
            try:
                # 尝试导入dotenv，如果不可用则跳过
                from dotenv import load_dotenv
                load_dotenv()
                if os.getenv('API_BASE_URL'):
                    config['api_base_url'] = os.getenv('API_BASE_URL')
                if os.getenv('API_KEY'):
                    config['api_key'] = os.getenv('API_KEY')
                if os.getenv('MODEL_NAME'):
                    config['model_name'] = os.getenv('MODEL_NAME')
                if os.getenv('CLASSIFICATION_PROMPT'):
                    config['classification_prompt'] = os.getenv('CLASSIFICATION_PROMPT')
                if os.getenv('VALID_CATEGORIES'):
                    config['valid_categories'] = os.getenv('VALID_CATEGORIES').split(',')
                if os.getenv('MAX_WORKERS'):
                    config['max_workers'] = int(os.getenv('MAX_WORKERS'))
            except (ImportError, Exception):
                # 如果模块不可用或加载失败，使用默认配置
                pass
        
        return config
    
    def clear_config(self):
        """清除所有配置并重置为默认值"""
        # 弹出确认对话框
        reply = QMessageBox.question(
            self,
            "清除配置",
            "您确定要清除所有配置并重置为默认值吗？\n\n"
            "这将删除您的API密钥和其他所有设置。",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            # 创建默认配置
            default_config = {
                'api_base_url': 'https://dashscope.aliyuncs.com/compatible-mode/v1',  # 默认阿里云通义千问API地址
                'api_key': '',  # 空密钥
                'model_name': 'qwen-vl-plus-latest',  # 默认模型
                'classification_prompt': '请分析这张图片属于哪一类别，只输出类别名称，不要其他解释。类别必须严格从以下选项中选择一个：{categories}',  # 默认提示词
                'valid_categories': '二次元,生活照片,宠物,工作,表情包'.split(','),  # 默认分类
                'max_workers': 4  # 默认并发数
            }
            
            # 清除QSettings
            self.settings.clear()
            
            # 保存默认配置
            self.config = default_config
            config_str = json.dumps(default_config)
            self.settings.setValue("config", config_str)
            self.settings.sync()
            
            # 更新UI中的配置面板
            self.load_config_to_panel()
            
            # 显示成功消息
            QMessageBox.information(
                self,
                "清除成功",
                "所有配置已成功清除并重置为默认值。\n\n"
                "请输入您的API密钥后再保存配置。",
                QMessageBox.Ok
            )
    
    def save_config(self, config):
        """保存配置到QSettings"""
        self.config = config
        config_str = json.dumps(config)
        self.settings.setValue("config", config_str)
        self.settings.sync()

    def ensure_directories(self):
        """确保必要的目录结构存在"""
        # 使用用户文档目录下的应用程序数据目录
        app_data_dir = os.path.join(os.path.expanduser("~"), "Documents", "VLMClassifier")
        
        # 创建应用程序数据目录
        os.makedirs(app_data_dir, exist_ok=True)
        
        # 设置输入和输出目录
        self.input_dir = os.getenv('INPUT_DIR', os.path.join(app_data_dir, 'input'))
        self.output_dir = os.getenv('OUTPUT_DIR', os.path.join(app_data_dir, 'output'))
        
        # 创建输入和输出目录
        os.makedirs(self.input_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 创建分类目录
        for category in self.categories:
            os.makedirs(os.path.join(self.output_dir, category), exist_ok=True)
            
        print(f"应用数据目录: {app_data_dir}")
        print(f"输入目录: {self.input_dir}")
        print(f"输出目录: {self.output_dir}")

    def setup_ui(self):
        """设置用户界面"""
        self.setWindowTitle("智能图片分类器")
        self.setMinimumSize(1200, 700)
        
        # 创建主窗口部件
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        main_widget.setObjectName("mainWidget")
        
        # 主布局
        main_layout = QHBoxLayout(main_widget)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(0)
        
        # 创建分割器，实现左右可调整宽度
        self.splitter = QSplitter(Qt.Horizontal)
        self.splitter.setObjectName("mainSplitter")
        self.splitter.setChildrenCollapsible(False)  # 防止完全折叠到看不见
        
        # 左侧分类区域
        left_widget = QWidget()
        left_widget.setObjectName("leftWidget")
        left_layout = QVBoxLayout(left_widget)
        left_layout.setContentsMargins(0, 0, 10, 0)
        left_layout.setSpacing(20)
        
        # 顶部控制区域
        control_frame = QFrame()
        control_frame.setObjectName("controlFrame")
        control_layout = QVBoxLayout(control_frame)
        control_layout.setContentsMargins(25, 25, 25, 25)
        control_layout.setSpacing(15)
        
        # 标题和描述
        title_label = QLabel("智能图片分类器")
        title_label.setObjectName("titleLabel")
        desc_label = QLabel("使用VLM模型自动将图片分类到指定类别")
        desc_label.setObjectName("descLabel")
        
        control_layout.addWidget(title_label)
        control_layout.addWidget(desc_label)
        
        # 按钮区域
        button_layout = QHBoxLayout()
        button_layout.setSpacing(15)
        
        self.select_btn = QPushButton("选择图片")
        self.select_btn.setObjectName("primaryButton")
        self.select_btn.clicked.connect(self.select_images)
        
        self.clear_btn = QPushButton("清空全部")
        self.clear_btn.setObjectName("dangerButton")
        self.clear_btn.clicked.connect(self.clear_images)
        
        self.start_btn = QPushButton("开始分类")
        self.start_btn.setObjectName("successButton")
        self.start_btn.clicked.connect(self.start_classification)
        
        self.open_folder_btn = QPushButton("打开分类结果")
        self.open_folder_btn.setObjectName("secondaryButton")
        self.open_folder_btn.clicked.connect(self.open_output_folder)
        
        for btn in [self.select_btn, self.clear_btn, self.start_btn, self.open_folder_btn]:
            btn.setMinimumWidth(130)
            btn.setMinimumHeight(40)
            button_layout.addWidget(btn)
        
        control_layout.addLayout(button_layout)
        
        # 添加控制区域阴影
        control_shadow = QGraphicsDropShadowEffect()
        control_shadow.setBlurRadius(20)
        control_shadow.setColor(QColor(0, 0, 0, 25))
        control_shadow.setOffset(0, 2)
        control_frame.setGraphicsEffect(control_shadow)
        
        left_layout.addWidget(control_frame)
        
        # 图片预览区域
        self.preview_area = DropArea()
        self.preview_area.files_dropped.connect(self.add_images)
        left_layout.addWidget(self.preview_area)
        
        # 进度条
        progress_layout = QHBoxLayout()
        self.progress_bar = QProgressBar()
        self.progress_bar.setObjectName("progressBar")
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setFormat("%p%")
        self.progress_bar.hide()
        progress_layout.addWidget(self.progress_bar)
        left_layout.addLayout(progress_layout)
        
        # 右侧配置区域容器
        self.right_container = QWidget()
        self.right_container.setObjectName("rightContainer")
        self.right_container.setVisible(False)  # 初始隐藏右侧容器
        right_container_layout = QHBoxLayout(self.right_container)
        right_container_layout.setContentsMargins(0, 0, 0, 0)
        right_container_layout.setSpacing(0)
        
        # 创建控制按钮容器
        self.toggle_container = QWidget()
        self.toggle_container.setObjectName("toggleContainer")
        self.toggle_container.setFixedWidth(40)  # 按钮容器宽度
        toggle_layout = QVBoxLayout(self.toggle_container)
        toggle_layout.setContentsMargins(0, 0, 0, 0)
        toggle_layout.setSpacing(0)
        toggle_layout.addStretch()
        
        # 折叠按钮
        self.toggle_btn = QToolButton()
        self.toggle_btn.setObjectName("toggleButton")
        self.toggle_btn.setText("▶")  # 右箭头（表示可展开）
        self.toggle_btn.setFixedSize(40, 120)
        self.toggle_btn.clicked.connect(self.toggle_config_panel)
        toggle_layout.addWidget(self.toggle_btn)
        toggle_layout.addStretch()
        
        # 右侧配置区域
        self.right_widget = QWidget()
        self.right_widget.setObjectName("rightWidget")
        right_layout = QVBoxLayout(self.right_widget)
        right_layout.setContentsMargins(10, 0, 10, 0)
        right_layout.setSpacing(20)
        
        # 配置面板
        config_scroll = QScrollArea()
        config_scroll.setObjectName("configScroll")
        config_scroll.setWidgetResizable(True)
        config_widget = QWidget()
        config_layout = QVBoxLayout(config_widget)
        config_layout.setContentsMargins(20, 20, 20, 20)
        config_layout.setSpacing(15)
        
        # 配置标题
        config_title = QLabel("配置设置")
        config_title.setObjectName("configTitle")
        config_layout.addWidget(config_title)
        
        # API配置组
        api_group = QGroupBox("API配置")
        api_layout = QFormLayout()
        
        self.api_base_url = QLineEdit()
        self.api_key = QLineEdit()
        self.model_name = QLineEdit()
        
        api_layout.addRow("API基础URL:", self.api_base_url)
        api_layout.addRow("API密钥:", self.api_key)
        api_layout.addRow("模型名称:", self.model_name)
        
        api_group.setLayout(api_layout)
        config_layout.addWidget(api_group)
        
        # 分类配置组
        class_group = QGroupBox("分类配置")
        class_layout = QFormLayout()
        
        self.classification_prompt = QTextEdit()
        self.classification_prompt.setMinimumHeight(100)
        self.valid_categories = QLineEdit()
        
        class_layout.addRow("分类提示词:", self.classification_prompt)
        class_layout.addRow("有效类别(逗号分隔):", self.valid_categories)
        
        class_group.setLayout(class_layout)
        config_layout.addWidget(class_group)
        
        # 性能配置组
        perf_group = QGroupBox("性能配置")
        perf_layout = QFormLayout()
        
        self.max_workers = QComboBox()
        for i in range(1, 9):
            self.max_workers.addItem(str(i))
        
        perf_layout.addRow("最大并发数:", self.max_workers)
        
        perf_group.setLayout(perf_layout)
        config_layout.addWidget(perf_group)
        
        # 保存按钮 - 放在顶部，使其更加明显
        save_btn_layout = QHBoxLayout()
        save_btn = QPushButton("保存配置")
        save_btn.setObjectName("primaryButton")  # 使用主要按钮样式
        save_btn.setMinimumHeight(50)  # 增加高度
        save_btn.setMinimumWidth(200)  # 设置最小宽度
        save_btn.setFont(QFont("Arial", 12))  # 设置字体
        save_btn.setStyleSheet("background-color: #0d6efd; color: white; font-weight: bold; border-radius: 5px;")
        save_btn.clicked.connect(self.save_config_from_panel)
        save_btn_layout.addStretch()
        save_btn_layout.addWidget(save_btn)
        
        # 添加清除配置按钮
        clear_btn = QPushButton("清除配置")
        clear_btn.setObjectName("secondaryButton")
        clear_btn.setMinimumHeight(50)
        clear_btn.setMinimumWidth(120)
        clear_btn.setFont(QFont("Arial", 12))
        clear_btn.setStyleSheet("background-color: #dc3545; color: white; font-weight: bold; border-radius: 5px;")
        clear_btn.clicked.connect(self.clear_config)
        save_btn_layout.addWidget(clear_btn)
        save_btn_layout.addStretch()
        
        # 添加一个标签，提醒用户保存配置
        save_hint = QLabel("填写完配置后请点击上方按钮保存")
        save_hint.setStyleSheet("color: #0d6efd; font-size: 12px;")
        save_hint.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        # 将保存按钮和提示放在配置面板的顶部
        config_layout.insertLayout(0, save_btn_layout)  # 在最前面插入保存按钮
        config_layout.insertWidget(1, save_hint)  # 在保存按钮后插入提示
        
        # 添加分隔线
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setFrameShadow(QFrame.Sunken)
        separator.setStyleSheet("background-color: #dee2e6; min-height: 2px;")
        config_layout.insertWidget(2, separator)  # 在提示后插入分隔线
        
        config_layout.addStretch()
        config_scroll.setWidget(config_widget)
        right_layout.addWidget(config_scroll)
        
        # 将配置面板添加到右侧容器
        right_container_layout.addWidget(self.right_widget)
        
        # 只将左侧面板添加到分割器中
        self.splitter.addWidget(left_widget)
        self.splitter.addWidget(self.right_container)
        
        # 添加到主布局
        main_layout.addWidget(self.splitter)
        main_layout.addWidget(self.toggle_container)
        
        # 状态栏
        self.statusBar().setObjectName("statusBar")
        self.statusBar().showMessage("就绪")
        
        # 加载配置到面板
        self.load_config_to_panel()
        
        # 应用全局样式
        self.apply_styles()

    def open_config_dialog(self):
        """打开配置对话框"""
        dialog = ConfigDialog(self, self.config)
        if dialog.exec_():
            # 获取新的配置
            new_config = dialog.get_config()
            
            # 保存配置
            self.save_config(new_config)
            
            # 提示用户重启应用
            QMessageBox.information(self, "配置已更新", 
                                  "配置已成功更新！请重启应用以应用新的配置。")
    
    def check_api_key_on_startup(self):
        """在应用程序启动时检查API密钥"""
        if not self.config.get('api_key'):
            # 如果API密钥为空，显示提示并打开配置面板
            QMessageBox.information(
                self,
                "欢迎使用VLMClassifier",
                "欢迎使用VLMClassifier图片分类器！\n\n"
                "请在配置面板中输入您的API密钥以开始使用。\n"
                "我们已经为您预设了阿里云通义千问API的基础URL。",
                QMessageBox.Ok
            )
            # 打开配置面板
            if not self.right_container.isVisible():
                self.toggle_config_panel()
    
    def toggle_config_panel(self):
        """切换配置面板的显示状态"""
        if not self.right_container.isVisible():  # 如果右侧面板已隐藏
            self.right_container.setVisible(True)  # 显示右侧容器
            self.splitter.setSizes([int(self.width() * 0.6), int(self.width() * 0.4)])  # 设置左右宽度比例60:40
            self.toggle_btn.setText("◀")  # 左箭头（表示可折叠）
        else:
            self.right_container.setVisible(False)  # 隐藏右侧容器
            self.toggle_btn.setText("▶")  # 右箭头（表示可展开）
    
    def load_config_to_panel(self):
        """加载配置到面板"""
        self.api_base_url.setText(self.config.get('api_base_url', ''))
        self.api_key.setText(self.config.get('api_key', ''))
        self.model_name.setText(self.config.get('model_name', 'qwen-vl-plus-latest'))
        self.classification_prompt.setText(self.config.get('classification_prompt', ''))
        self.valid_categories.setText(','.join(self.config.get('valid_categories', [])))
        self.max_workers.setCurrentText(str(self.config.get('max_workers', 4)))
    
    def save_config_from_panel(self):
        """从面板保存配置"""
        # 获取用户输入的API密钥和API基础URL
        api_key = self.api_key.text().strip()
        api_base_url = self.api_base_url.text().strip()
        
        # 检查API密钥是否为空
        if not api_key:
            # 显示错误消息
            QMessageBox.warning(
                self,
                "配置错误",
                "请输入您的API密钥后再保存配置。\n\n没有API密钥将无法使用图片分类功能。",
                QMessageBox.Ok
            )
            return
        

        
        new_config = {
            'api_base_url': api_base_url,
            'api_key': api_key,
            'model_name': self.model_name.text().strip() or 'qwen-vl-plus-latest',  # 确保有默认值
            'classification_prompt': self.classification_prompt.toPlainText().strip(),
            'valid_categories': [cat.strip() for cat in self.valid_categories.text().split(',') if cat.strip()],
            'max_workers': int(self.max_workers.currentText())
        }
        
        # 保存配置
        self.save_config(new_config)
        
        # 如果分类器尚未初始化，则初始化它
        if not hasattr(self, 'classifier') or self.classifier is None:
            try:
                # 初始化分类器
                self.classifier = ImageClassifier(
                    api_base_url=new_config.get('api_base_url'),
                    api_key=new_config.get('api_key'),
                    model_name=new_config.get('model_name'),
                    classification_prompt=new_config.get('classification_prompt'),
                    valid_categories=new_config.get('valid_categories'),
                    max_workers=new_config.get('max_workers', 4)
                )
                # 更新类别列表
                self.categories = self.classifier.valid_categories + ["其他"]
                # 确保目录结构存在
                self.ensure_directories()
                print("分类器已初始化")
            except Exception as e:
                print(f"初始化分类器时出错: {str(e)}")
        else:
            # 更新分类器配置
            try:
                self.classifier.api_base_url = new_config['api_base_url']
                self.classifier.api_key = new_config['api_key']
                self.classifier.model_name = new_config['model_name']
                self.classifier.classification_prompt = new_config['classification_prompt']
                self.classifier.valid_categories = new_config['valid_categories']
                # 更新类别列表
                self.categories = self.classifier.valid_categories + ["其他"]
                # 确保目录结构存在
                self.ensure_directories()
                print("分类器配置已更新")
            except Exception as e:
                print(f"更新分类器配置时出错: {str(e)}")
        
        # 提示用户配置已更新
        QMessageBox.information(self, "配置已更新", 
                              "配置已成功更新！现在可以直接使用新的配置进行分类。")
    
    def apply_styles(self):
        self.setStyleSheet("""
            QWidget#mainWidget {
                background-color: #f8f9fa;
            }
            QFrame#controlFrame {
                background-color: white;
                border-radius: 15px;
            }
            QLabel#titleLabel {
                font-size: 28px;
                font-weight: bold;
                color: #212529;
            }
            QLabel#descLabel {
                font-size: 16px;
                color: #6c757d;
                margin-bottom: 10px;
            }
            QPushButton {
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
            }
            QPushButton#primaryButton {
                background-color: #0d6efd;
                color: white;
                border: none;
            }
            QPushButton#primaryButton:hover {
                background-color: #0b5ed7;
            }
            QPushButton#successButton {
                background-color: #198754;
                color: white;
                border: none;
            }
            QPushButton#successButton:hover {
                background-color: #157347;
            }
            QPushButton#secondaryButton {
                background-color: #6c757d;
                color: white;
                border: none;
            }
            QPushButton#secondaryButton:hover {
                background-color: #5c636a;
            }
            QPushButton#dangerButton {
                background-color: #dc3545;
                color: white;
                border: none;
            }
            QPushButton#dangerButton:hover {
                background-color: #bb2d3b;
            }
            QWidget#toggleContainer {
                background-color: transparent;
            }
            QWidget#rightContainer {
                background-color: transparent;
            }
            QWidget#rightWidget {
                background-color: white;
                border-left: none;
                color: #333333;
            }
            QToolButton#toggleButton {
                background-color: #0d6efd;
                border: 2px solid #0b5ed7;
                border-radius: 5px;
                color: white;
                font-size: 20px;
                font-weight: bold;
                margin: 0;
            }
            QToolButton#toggleButton:hover {
                background-color: #0b5ed7;
                color: white;
            }
            QLabel#configTitle {
                font-size: 22px;
                font-weight: bold;
                color: #0d6efd;
                margin-bottom: 15px;
            }
            QGroupBox {
                font-weight: bold;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                margin-top: 1.5em;
                padding-top: 1.5em;
                color: #333333;
                background-color: #f8f9fa;
                padding: 15px;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 8px;
                color: #0d6efd;
                font-size: 14px;
                background-color: #f8f9fa;
            }
            QScrollArea#configScroll {
                border: none;
                background-color: transparent;
            }
            QScrollArea#configScroll QWidget {
                background-color: white;
            }
            QLineEdit, QTextEdit, QComboBox {
                padding: 10px;
                border: 1px solid #ced4da;
                border-radius: 6px;
                background-color: white;
                color: #333333;
                selection-background-color: #0d6efd;
                font-size: 13px;
                margin-top: 2px;
                margin-bottom: 8px;
            }
            QLineEdit:focus, QTextEdit:focus, QComboBox:focus {
                border-color: #0d6efd;
                outline: 0;
                background-color: white;
                border-width: 2px;
            }
            QComboBox::drop-down {
                subcontrol-origin: padding;
                subcontrol-position: top right;
                width: 25px;
                border-left: 1px solid #ced4da;
                border-top-right-radius: 6px;
                border-bottom-right-radius: 6px;
            }
            QComboBox::down-arrow {
                width: 14px;
                height: 14px;
            }
            QWidget#rightWidget QLabel {
                color: #333333;
                font-size: 13px;
                font-weight: bold;
                margin-top: 5px;
            }
            QPushButton#configSaveButton {
                background-color: #0d6efd;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                padding: 8px 20px;
                min-width: 150px;
            }
            QPushButton#configSaveButton:hover {
                background-color: #0b5ed7;
            }
            QStatusBar {
                background-color: white;
                color: #6c757d;
                padding: 8px;
                font-size: 13px;
            }
            QProgressBar {
                border: none;
                background-color: #e9ecef;
                border-radius: 8px;
                height: 16px;
                text-align: center;
            }
            QProgressBar::chunk {
                background-color: #0d6efd;
                border-radius: 8px;
            }
            
            /* 滚动条样式 */
            QSplitter::handle {
                background-color: #e0e0e0;
                width: 1px;
            }
            QSplitter::handle:hover {
                background-color: #0d6efd;
            }
            
            QScrollBar:vertical {
                background-color: transparent;
                width: 8px;
                margin: 0px;
                border-radius: 4px;
            }
            
            QScrollBar::handle:vertical {
                background-color: #d1d1d1;
                min-height: 30px;
                border-radius: 4px;
            }
            
            QScrollBar::handle:vertical:hover {
                background-color: #0d6efd;
            }
            
            QScrollBar::sub-line:vertical, QScrollBar::add-line:vertical {
                height: 0px;
                background: none;
            }
            
            QScrollBar::up-arrow:vertical, QScrollBar::down-arrow:vertical {
                background: none;
            }
            
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
                background: none;
            }
            
            QScrollBar:horizontal {
                background-color: transparent;
                height: 8px;
                margin: 0px;
                border-radius: 4px;
            }
            
            QScrollBar::handle:horizontal {
                background-color: #d1d1d1;
                min-width: 30px;
                border-radius: 4px;
            }
            
            QScrollBar::handle:horizontal:hover {
                background-color: #0d6efd;
            }
            
            QScrollBar::sub-line:horizontal, QScrollBar::add-line:horizontal {
                width: 0px;
                background: none;
            }
            
            QScrollBar::left-arrow:horizontal, QScrollBar::right-arrow:horizontal {
                background: none;
            }
            
            QScrollBar::add-page:horizontal, QScrollBar::sub-page:horizontal {
                background: none;
            }
        """)

    def select_images(self):
        """选择图片文件或文件夹"""
        dialog = QFileDialog(self)
        dialog.setWindowTitle("选择图片或文件夹")
        dialog.setFileMode(QFileDialog.FileMode.Directory)
        dialog.setOption(QFileDialog.Option.ShowDirsOnly, False)
        dialog.setOption(QFileDialog.Option.DontUseNativeDialog, True)
        dialog.setNameFilter("所有文件 (*)")
        
        if dialog.exec_():
            selected_files = dialog.selectedFiles()
            files = []
            for path in selected_files:
                if os.path.isdir(path):
                    # 如果是文件夹，递归获取所有图片
                    for root, _, filenames in os.walk(path):
                        for filename in filenames:
                            file_path = os.path.join(root, filename)
                            if file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                                files.append(file_path)
                elif path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
                    # 如果是图片文件，直接添加
                    files.append(path)
            
            if files:
                self.add_images(files)

    def add_images(self, files):
        """添加图片到预览区域"""
        if not files:
            return
            
        # 清除提示标签
        if self.preview_area.hint_label.isVisible():
            self.preview_area.hint_label.hide()
        
        # 添加新的图片预览
        added_count = 0
        for file in files:
            if file not in self.images:
                self.images.append(file)
                preview = ImagePreviewWidget(file)
                preview.removed.connect(self.remove_image)
                self.preview_area.layout.addWidget(preview)
                added_count += 1
        
        if added_count > 0:
            self.statusBar().showMessage(f"已添加 {added_count} 个文件")
        else:
            self.statusBar().showMessage("所选文件已存在")
            
    def remove_image(self, image_path):
        """移除指定图片"""
        if image_path in self.images:
            self.images.remove(image_path)
            
        # 如果没有图片了，显示提示标签
        if not self.images:
            self.preview_area.hint_label.show()
            
        self.statusBar().showMessage("已移除 1 个文件")
        
    def clear_images(self):
        """清空所有图片"""
        if not self.images:
            return
            
        reply = QMessageBox.question(
            self,
            "确认清空",
            "确定要清空所有已添加的图片吗？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            # 清空图片列表
            self.images.clear()
            
            # 移除所有预览组件
            while self.preview_area.layout.count() > 1:  # 保留hint_label
                item = self.preview_area.layout.takeAt(1)
                if item.widget():
                    item.widget().deleteLater()
            
            # 显示提示标签
            self.preview_area.hint_label.show()
            self.statusBar().showMessage("已清空所有图片")

    def start_classification(self):
        """开始分类过程"""
        if not self.images:
            QMessageBox.warning(self, "警告", "请先选择要分类的图片！")
            return
            
        # 检查API配置是否已填写
        if not self.config.get('api_base_url') or not self.config.get('api_key') or not self.config.get('classification_prompt'):
            reply = QMessageBox.warning(
                self, 
                "API配置缺失", 
                "请先在右侧面板中填写API配置信息！\n\n您需要填写API基础URL、API密钥和分类提示词才能使用分类功能。",
                QMessageBox.Ok | QMessageBox.Cancel,
                QMessageBox.Ok
            )
            
            if reply == QMessageBox.Ok:
                if not self.right_container.isVisible():
                    self.toggle_config_panel()  # 自动打开配置面板
            return
            
        if self.classification_thread and self.classification_thread.isRunning():
            self.classification_thread.stop()
            self.classification_thread.wait()
            self.start_btn.setText("开始分类")
            self.statusBar().showMessage("分类已停止")
            return

        # 初始化分类器（如果还没有初始化）
        try:
            self.classifier = ImageClassifier(
                api_base_url=self.config.get('api_base_url'),
                api_key=self.config.get('api_key'),
                model_name=self.config.get('model_name'),
                classification_prompt=self.config.get('classification_prompt'),
                valid_categories=self.config.get('valid_categories'),
                max_workers=self.config.get('max_workers', 4)
            )
            # 更新类别列表
            self.categories = self.classifier.valid_categories + ["其他"]
            # 确保目录结构存在
            self.ensure_directories()
        except Exception as e:
            QMessageBox.critical(self, "初始化错误",
                               f"初始化分类器时出错: {str(e)}\n请检查配置设置。")
            return

        # 禁用相关按钮
        self.select_btn.setEnabled(False)
        self.start_btn.setText("停止分类")
        
        # 创建并启动分类线程
        self.classification_thread = ClassificationThread(
            self.classifier, self.images, self.output_dir
        )
        
        # 显示进度条
        self.progress_bar.setValue(0)
        self.progress_bar.show()
        
        # 连接信号
        self.classification_thread.progress_signal.connect(
            lambda msg: self.statusBar().showMessage(msg)
        )
        self.classification_thread.progress_value.connect(self.progress_bar.setValue)
        self.classification_thread.finished_signal.connect(self.classification_finished)
        self.classification_thread.error_signal.connect(self.classification_error)
        
        self.classification_thread.start()

    def classification_finished(self):
        """分类完成的处理"""
        self.select_btn.setEnabled(True)
        self.start_btn.setText("开始分类")
        
        # 清空预览区
        while self.preview_area.layout.count() > 1:
            item = self.preview_area.layout.takeAt(1)
            if item.widget():
                item.widget().deleteLater()
        
        self.images.clear()
        self.preview_area.hint_label.show()
        
        # 隐藏进度条
        self.progress_bar.hide()
        
        self.statusBar().showMessage("分类完成！")
        QMessageBox.information(self, "完成", "所有图片已完成分类！")

    def classification_error(self, error_msg):
        """处理分类过程中的错误"""
        self.select_btn.setEnabled(True)
        self.start_btn.setText("开始分类")
        # 隐藏并重置进度条
        self.progress_bar.hide()
        self.progress_bar.setValue(0)
        self.statusBar().showMessage("分类出错")
        QMessageBox.critical(self, "错误", f"分类过程中出错：{error_msg}")

    def open_output_folder(self):
        """打开输出文件夹"""
        os.startfile(self.output_dir) if sys.platform == 'win32' \
            else os.system(f'open {self.output_dir}') if sys.platform == 'darwin' \
            else os.system(f'xdg-open {self.output_dir}')


        


if __name__ == "__main__":
    # 添加日志文件
    import logging
    import tempfile
    
    # 创建日志目录
    log_dir = os.path.join(os.path.expanduser("~"), "VLMClassifier_logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "vlmclassifier_error.log")
    
    # 配置日志
    logging.basicConfig(
        filename=log_file,
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    try:
        app = QApplication(sys.argv)
        
        # 设置应用样式
        app.setStyle('Fusion')
        
        # 创建并显示主窗口
        logging.info("Starting application...")
        window = ImageClassifierApp()
        logging.info("Application window created successfully")
        window.show()
        logging.info("Window shown")
        
        sys.exit(app.exec_())
    except Exception as e:
        logging.exception(f"Application crashed with error: {str(e)}")
        # 创建一个简单的错误窗口
        error_app = QApplication(sys.argv) if not 'app' in locals() else app
        error_msg = QMessageBox()
        error_msg.setIcon(QMessageBox.Critical)
        error_msg.setText(f"程序出错\n\n{str(e)}")
        error_msg.setInformativeText(f"错误日志已保存到: {log_file}")
        error_msg.setWindowTitle("错误")
        error_msg.exec_()
        sys.exit(1)
