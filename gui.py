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
from PyQt5.QtCore import Qt, QSize, QThread, pyqtSignal, QMimeData, QPoint, QSettings
from PyQt5.QtGui import QPixmap, QDragEnterEvent, QDropEvent, QPalette, QColor
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
        
        try:
            self.classifier = ImageClassifier(
                api_base_url=self.config.get('api_base_url'),
                api_key=self.config.get('api_key'),
                model_name=self.config.get('model_name'),
                classification_prompt=self.config.get('classification_prompt'),
                valid_categories=self.config.get('valid_categories'),
                max_workers=self.config.get('max_workers', 4)
            )
            self.categories = self.classifier.valid_categories + ["其他"]
        except Exception as e:
            QMessageBox.critical(self, "初始化错误",
                               f"初始化分类器时出错: {str(e)}\n请检查配置设置。")
            sys.exit(1)

        # 确保目录结构
        self.ensure_directories()
        
        # 设置界面
        self.setup_ui()
    
    def load_config(self):
        """从QSettings加载配置"""
        config = {}
        
        # 尝试从QSettings加载
        if self.settings.contains("config"):
            config_str = self.settings.value("config")
            try:
                config = json.loads(config_str)
            except:
                pass
        
        # 如果QSettings中没有配置，尝试从.env加载默认值
        if not config:
            load_dotenv()
            config = {
                'api_base_url': os.getenv('API_BASE_URL', ''),
                'api_key': os.getenv('API_KEY', ''),
                'model_name': os.getenv('MODEL_NAME', 'qwen-vl-plus-latest'),
                'classification_prompt': os.getenv('CLASSIFICATION_PROMPT', ''),
                'valid_categories': os.getenv('VALID_CATEGORIES', '二次元,生活照片,宠物,工作,表情包').split(','),
                'max_workers': int(os.getenv('MAX_WORKERS', '4'))
            }
        
        return config
    
    def save_config(self, config):
        """保存配置到QSettings"""
        self.config = config
        config_str = json.dumps(config)
        self.settings.setValue("config", config_str)
        self.settings.sync()

    def ensure_directories(self):
        """确保必要的目录结构存在"""
        self.input_dir = os.getenv('INPUT_DIR', 'images/input')
        self.output_dir = os.getenv('OUTPUT_DIR', 'images/output')
        
        os.makedirs(self.input_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)
        
        for category in self.categories:
            os.makedirs(os.path.join(self.output_dir, category), exist_ok=True)

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
        
        # 创建布局来单独放置折叠按钮
        toggle_btn_layout = QVBoxLayout()
        toggle_btn_layout.setContentsMargins(0, 0, 0, 0)
        toggle_btn_layout.addStretch()
        
        # 侧边栏容器（包含配置面板）
        self.sidebar_container = QWidget()
        self.sidebar_container.setObjectName("sidebarContainer")
        self.sidebar_container.setFixedWidth(40)  # 初始只显示按钮宽度
        sidebar_layout = QHBoxLayout(self.sidebar_container)
        sidebar_layout.setContentsMargins(0, 0, 0, 0)
        sidebar_layout.setSpacing(0)
        
        # 折叠按钮
        self.toggle_btn = QToolButton()
        self.toggle_btn.setObjectName("toggleButton")
        self.toggle_btn.setText("▶")  # 右箭头（表示可展开）
        self.toggle_btn.setFixedSize(40, 120)
        self.toggle_btn.clicked.connect(self.toggle_config_panel)
        toggle_btn_layout.addWidget(self.toggle_btn)
        toggle_btn_layout.addStretch()
        
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
        
        # 保存按钮
        save_btn_layout = QHBoxLayout()
        save_btn = QPushButton("保存配置")
        save_btn.setObjectName("configSaveButton")
        save_btn.setMinimumHeight(40)
        save_btn.clicked.connect(self.save_config_from_panel)
        save_btn_layout.addStretch()
        save_btn_layout.addWidget(save_btn)
        save_btn_layout.addStretch()
        config_layout.addLayout(save_btn_layout)
        
        config_layout.addStretch()
        config_scroll.setWidget(config_widget)
        right_layout.addWidget(config_scroll)
        
        # 添加配置面板到侧边栏容器
        sidebar_layout.addWidget(self.right_widget)
        
        # 添加到主布局
        main_layout.addWidget(left_widget)
        main_layout.addLayout(toggle_btn_layout)
        main_layout.addWidget(self.sidebar_container)
        
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
    
    def toggle_config_panel(self):
        """切换配置面板的显示状态"""
        if self.sidebar_container.width() <= 40:  # 面板隐藏状态
            self.sidebar_container.setFixedWidth(400)  # 显示面板
            self.toggle_btn.setText("◀")  # 左箭头（表示可折叠）
        else:
            self.sidebar_container.setFixedWidth(0)  # 完全隐藏面板
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
        new_config = {
            'api_base_url': self.api_base_url.text().strip(),
            'api_key': self.api_key.text().strip(),
            'model_name': self.model_name.text().strip(),
            'classification_prompt': self.classification_prompt.toPlainText().strip(),
            'valid_categories': [cat.strip() for cat in self.valid_categories.text().split(',') if cat.strip()],
            'max_workers': int(self.max_workers.currentText())
        }
        
        # 保存配置
        self.save_config(new_config)
        
        # 提示用户重启应用
        QMessageBox.information(self, "配置已更新", 
                              "配置已成功更新！请重启应用以应用新的配置。")
    
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
            QWidget#sidebarContainer {
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
            
        if self.classification_thread and self.classification_thread.isRunning():
            self.classification_thread.stop()
            self.classification_thread.wait()
            self.start_btn.setText("开始分类")
            self.statusBar().showMessage("分类已停止")
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
    app = QApplication(sys.argv)
    
    # 设置应用样式
    app.setStyle('Fusion')
    
    # 创建并显示主窗口
    window = ImageClassifierApp()
    window.show()
    
    sys.exit(app.exec_())



if __name__ == "__main__":
    app = QApplication(sys.argv)
    
    # 设置应用样式
    app.setStyle('Fusion')
    
    # 创建并显示主窗口
    window = ImageClassifierApp()
    window.show()
    
    sys.exit(app.exec_())
