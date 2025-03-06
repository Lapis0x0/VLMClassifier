import os
import sys
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, TkVersion
import customtkinter as ctk
from PIL import Image, ImageTk
import shutil
import glob
from image_classifier import ImageClassifier

# 设置外观模式和颜色主题
ctk.set_appearance_mode("System")  # 跟随系统主题
ctk.set_default_color_theme("blue")  # 设置默认颜色主题

# 导入TkinterDnD（用于拖放）
HAS_DND = False
try:
    import tkinterdnd2
    from tkinterdnd2 import DND_FILES, TkinterDnD
    
    # 测试TkDnD TCL包是否可用
    test_tk = tk.Tk()
    try:
        test_tk.tk.call('package', 'require', 'tkDND')
        HAS_DND = True
    except tk.TclError:
        print("警告: tkDND TCL包不可用，拖放功能将被禁用。")
        print("设备可能需要安装TkDND库才能使用拖放功能。")
    finally:
        test_tk.destroy()
except ImportError:
    print("警告: tkinterdnd2未安装，拖放功能将被禁用。")
    print("请运行: pip install tkinterdnd2 以启用拖放功能。")

class ImageClassifierApp(ctk.CTk):
    """图片分类器GUI应用"""
    # 检查是否有拖放支持
    if HAS_DND:
        # 使用TkinterDnD的Tk作为基类
        def __new__(cls, *args, **kwargs):
            # 使用TkinterDnD的Toplevel基类
            cls._use_dnd = True
            return TkinterDnD.Tk.__new__(cls)
    else:
        # 没有拖放支持时的默认实现
        def __new__(cls, *args, **kwargs):
            cls._use_dnd = False
            return super(ImageClassifierApp, cls).__new__(cls)
    def __init__(self):
        super().__init__()
        
        # 配置窗口
        self.title("智能图片分类器")
        self.geometry("1000x700")
        self.minsize(800, 600)
        
        # 初始化图片分类器
        try:
            self.classifier = ImageClassifier()
            self.categories = self.classifier.valid_categories + ["其他"]
            self.is_processing = False
        except Exception as e:
            messagebox.showerror("初始化错误", f"初始化分类器时出错: {str(e)}\n请检查.env文件中的配置。")
            sys.exit(1)
        
        # 创建文件夹结构
        self.ensure_directories()
        
        # 创建UI组件
        self.create_ui()
        
        # 事件绑定
        self.bind("<Escape>", lambda e: self.quit())

    def ensure_directories(self):
        """确保必要的目录结构存在"""
        # 获取目录配置
        self.input_dir = os.getenv('INPUT_DIR', 'images/input')
        self.output_dir = os.getenv('OUTPUT_DIR', 'images/output')
        
        # 确保输入目录存在
        if not os.path.exists(self.input_dir):
            os.makedirs(self.input_dir, exist_ok=True)
        
        # 确保输出目录及各分类子目录存在
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir, exist_ok=True)
        
        # 为每个类别创建子目录
        for category in self.categories:
            category_dir = os.path.join(self.output_dir, category)
            if not os.path.exists(category_dir):
                os.makedirs(category_dir, exist_ok=True)

    def create_ui(self):
        """创建用户界面"""
        # 创建主框架
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)
        
        # 创建主容器
        main_frame = ctk.CTkFrame(self)
        main_frame.grid(row=0, column=0, padx=20, pady=20, sticky="nsew")
        main_frame.grid_columnconfigure(0, weight=1)
        main_frame.grid_rowconfigure(1, weight=1)
        
        # 顶部控制区域
        control_frame = ctk.CTkFrame(main_frame)
        control_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        
        # 添加标题
        title_label = ctk.CTkLabel(
            control_frame, 
            text="智能图片分类器", 
            font=ctk.CTkFont(size=24, weight="bold")
        )
        title_label.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="w")
        
        # 添加描述
        desc_label = ctk.CTkLabel(
            control_frame,
            text="使用VLM模型自动将图片分类到指定类别",
            font=ctk.CTkFont(size=14)
        )
        desc_label.grid(row=1, column=0, padx=20, pady=(0, 20), sticky="w")
        
        # 创建按钮区域
        button_frame = ctk.CTkFrame(control_frame)
        button_frame.grid(row=2, column=0, padx=20, pady=(0, 20), sticky="ew")
        
        # 添加图片按钮
        self.select_btn = ctk.CTkButton(
            button_frame, 
            text="选择图片", 
            font=ctk.CTkFont(size=14),
            command=self.select_images
        )
        self.select_btn.grid(row=0, column=0, padx=10, pady=10)
        
        # 开始分类按钮
        self.start_btn = ctk.CTkButton(
            button_frame, 
            text="开始分类", 
            font=ctk.CTkFont(size=14),
            command=self.start_classification
        )
        self.start_btn.grid(row=0, column=1, padx=10, pady=10)
        
        # 打开输出文件夹按钮
        self.open_folder_btn = ctk.CTkButton(
            button_frame, 
            text="打开分类结果", 
            font=ctk.CTkFont(size=14),
            command=self.open_output_folder
        )
        self.open_folder_btn.grid(row=0, column=2, padx=10, pady=10)
        
        # 创建图片预览和状态区域
        content_frame = ctk.CTkFrame(main_frame)
        content_frame.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")
        content_frame.grid_columnconfigure(0, weight=3)
        content_frame.grid_columnconfigure(1, weight=2)
        content_frame.grid_rowconfigure(0, weight=1)
        
        # 启用内容框架的拖放功能
        self.setup_drag_drop(content_frame)
        
        # 图片预览区域
        self.preview_frame = ctk.CTkFrame(content_frame)
        self.preview_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        self.preview_frame.grid_columnconfigure(0, weight=1)
        self.preview_frame.grid_rowconfigure(0, weight=0)
        self.preview_frame.grid_rowconfigure(1, weight=1)
        
        # 设置预览区域为拖放目标
        self.setup_drag_drop(self.preview_frame)
        
        # 预览区标题
        preview_title = ctk.CTkLabel(
            self.preview_frame, 
            text="待分类图片", 
            font=ctk.CTkFont(size=16, weight="bold")
        )
        preview_title.grid(row=0, column=0, padx=10, pady=10, sticky="w")
        
        # 图片预览容器
        self.image_container = ctk.CTkScrollableFrame(self.preview_frame)
        self.image_container.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")
        
        # 添加提示标签
        self.drop_label = ctk.CTkLabel(
            self.image_container,
            text="点击选择或拖放图片到此处" if hasattr(self, '_use_dnd') and self._use_dnd else "点击上方按钮选择图片",
            font=ctk.CTkFont(size=16),
            text_color="gray"
        )
        self.drop_label.pack(pady=50)
        
        # 设置滚动容器为拖放目标
        # 直接设置是整个容器，而不是访问内部属性
        self.setup_drag_drop(self.image_container)
        
        # 分类统计区域
        self.stats_frame = ctk.CTkFrame(content_frame)
        self.stats_frame.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")
        self.stats_frame.grid_columnconfigure(0, weight=1)
        self.stats_frame.grid_rowconfigure(0, weight=0)
        self.stats_frame.grid_rowconfigure(1, weight=1)
        
        # 统计区标题
        stats_title = ctk.CTkLabel(
            self.stats_frame, 
            text="分类统计", 
            font=ctk.CTkFont(size=16, weight="bold")
        )
        stats_title.grid(row=0, column=0, padx=10, pady=10, sticky="w")
        
        # 统计信息容器
        self.stats_container = ctk.CTkFrame(self.stats_frame)
        self.stats_container.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")
        
        # 初始化统计标签
        self.category_labels = {}
        self.category_counts = {}
        
        for i, category in enumerate(self.categories):
            # 创建类别标签
            category_label = ctk.CTkLabel(
                self.stats_container,
                text=f"{category}:",
                font=ctk.CTkFont(size=14, weight="bold")
            )
            category_label.grid(row=i, column=0, padx=20, pady=10, sticky="w")
            
            # 创建计数标签
            count_label = ctk.CTkLabel(
                self.stats_container,
                text="0",
                font=ctk.CTkFont(size=14)
            )
            count_label.grid(row=i, column=1, padx=20, pady=10, sticky="e")
            
            # 保存引用
            self.category_labels[category] = category_label
            self.category_counts[category] = count_label
        
        # 底部状态栏
        self.status_bar = ctk.CTkLabel(
            main_frame, 
            text="就绪",
            anchor="w",
            font=ctk.CTkFont(size=12)
        )
        self.status_bar.grid(row=2, column=0, padx=10, pady=(5, 10), sticky="ew")
        
        # 进度条
        self.progress_bar = ctk.CTkProgressBar(main_frame)
        self.progress_bar.grid(row=3, column=0, padx=20, pady=(0, 20), sticky="ew")
        self.progress_bar.set(0)

    def setup_drag_drop(self, widget):
        """为控件设置拖放功能"""
        # 仅当支持拖放功能时才设置
        if hasattr(self, '_use_dnd') and self._use_dnd:
            try:
                # 绑定拖放事件
                widget.drop_target_register(DND_FILES)
                widget.dnd_bind("<<Drop>>", self.on_drop)
                
                # 高亮显示拖放区域
                widget.bind("<DragEnter>", self.on_drag_enter)
                widget.bind("<DragLeave>", self.on_drag_leave)
            except Exception as e:
                print(f"设置拖放功能时出错: {e}")
                self._use_dnd = False
    
    def on_drag_enter(self, event):
        """当拖放进入目标区域时的处理"""
        # 更改状态栏提示
        self.status_bar.configure(text="释放鼠标以添加图片")
    
    def on_drag_leave(self, event):
        """当拖放离开目标区域时的处理"""
        # 恢复状态栏
        self.status_bar.configure(text="就绪")
    
    def on_drop(self, event):
        """处理拖放事件"""
        if self.is_processing:
            messagebox.showwarning("处理中", "请等待当前处理完成后再添加新图片")
            return
        
        # 获取拖放的文件或文件夹路径
        paths = self.parse_drop_data(event.data)
        if not paths:
            return
        
        # 收集所有图片文件
        image_files = []
        for path in paths:
            if os.path.isfile(path) and self.is_image_file(path):
                image_files.append(path)
            elif os.path.isdir(path):
                # 递归获取文件夹中的所有图片
                for ext in ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.bmp']:
                    image_files.extend(glob.glob(os.path.join(path, '**', ext), recursive=True))
        
        if not image_files:
            messagebox.showinfo("提示", "未找到有效的图片文件")
            return
        
        # 处理找到的图片文件
        self.process_selected_files(image_files)
    
    def parse_drop_data(self, data):
        """解析拖放数据，提取文件路径"""
        # macOS 和 Windows 平台的路径格式不同
        if sys.platform == 'darwin':  # macOS
            # 移除可能的前缀并分割多个文件
            if data.startswith('{') and data.endswith('}'): 
                data = data[1:-1]
            paths = data.split('} {')
            return [path.strip() for path in paths]
        else:  # Windows 和其他平台
            return data.split()
    
    def is_image_file(self, file_path):
        """检查文件是否为图片"""
        ext = os.path.splitext(file_path.lower())[1]
        return ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
    
    def select_images(self):
        """选择图片对话框"""
        if self.is_processing:
            messagebox.showwarning("处理中", "请等待当前处理完成后再选择新图片")
            return
            
        files = filedialog.askopenfilenames(
            title="选择图片",
            filetypes=[
                ("图片文件", "*.jpg *.jpeg *.png *.gif *.bmp"),
                ("所有文件", "*.*")
            ]
        )
        
        if not files:
            return
            
        # 处理选择的文件
        self.process_selected_files(files)
    
    def process_selected_files(self, files):
        """处理选择的文件"""
        # 清空预览区
        for widget in self.image_container.winfo_children():
            widget.destroy()
            
        # 清空输入文件夹
        for file in os.listdir(self.input_dir):
            file_path = os.path.join(self.input_dir, file)
            if os.path.isfile(file_path):
                os.remove(file_path)
                
        # 复制选择的文件到输入文件夹
        for i, file in enumerate(files):
            # 复制文件
            filename = os.path.basename(file)
            dest_path = os.path.join(self.input_dir, filename)
            shutil.copy2(file, dest_path)
            
            # 创建预览
            try:
                # 只显示前10张图片预览
                if i < 10:
                    self.add_image_preview(file, filename)
            except Exception as e:
                print(f"无法创建预览: {str(e)}")
                
        total_files = len(files)
        self.status_bar.configure(text=f"已选择 {total_files} 张图片")
        
        if total_files > 10:
            more_label = ctk.CTkLabel(
                self.image_container,
                text=f"... 还有 {total_files - 10} 张图片 ...",
                font=ctk.CTkFont(size=12, slant="italic")
            )
            more_label.pack(pady=10)
    
    def add_image_preview(self, image_path, filename):
        """添加图片预览到UI"""
        # 创建图片帧
        img_frame = ctk.CTkFrame(self.image_container)
        img_frame.pack(fill=tk.X, padx=5, pady=5)
        
        try:
            # 加载图片并调整大小
            img = Image.open(image_path)
            img.thumbnail((120, 120))
            photo = ImageTk.PhotoImage(img)
            
            # 创建标签显示图片
            img_label = tk.Label(img_frame, image=photo, bg="#333333")
            img_label.image = photo  # 保持引用
            img_label.pack(side=tk.LEFT, padx=10, pady=10)
            
            # 添加文件名
            name_label = ctk.CTkLabel(
                img_frame,
                text=filename,
                font=ctk.CTkFont(size=12)
            )
            name_label.pack(side=tk.LEFT, padx=10, fill=tk.BOTH, expand=True)
            
        except Exception as e:
            # 如果无法加载图片，显示错误信息
            error_label = ctk.CTkLabel(
                img_frame,
                text=f"无法加载图片 {filename}: {str(e)}",
                font=ctk.CTkFont(size=12)
            )
            error_label.pack(side=tk.LEFT, padx=10, pady=10, fill=tk.BOTH, expand=True)
    
    def start_classification(self):
        """开始图片分类过程"""
        if self.is_processing:
            messagebox.showwarning("处理中", "已有分类任务正在进行")
            return
            
        # 获取输入文件夹中的图片
        image_files = [f for f in os.listdir(self.input_dir) 
                     if os.path.isfile(os.path.join(self.input_dir, f))
                     and f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp'))]
        
        if not image_files:
            messagebox.showinfo("提示", "没有找到图片，请先选择图片")
            return
            
        # 重置统计
        for category in self.categories:
            self.category_counts[category].configure(text="0")
            
        # 更新UI状态
        self.is_processing = True
        self.select_btn.configure(state="disabled")
        self.start_btn.configure(state="disabled")
        self.progress_bar.set(0)
        self.status_bar.configure(text=f"正在处理 0/{len(image_files)} 张图片...")
        
        # 启动线程处理图片
        threading.Thread(target=self.process_images, args=(image_files,)).start()
    
    def process_images(self, image_files):
        """在后台线程中处理图片"""
        total = len(image_files)
        processed = 0
        category_stats = {category: 0 for category in self.categories}
        
        try:
            for img_file in image_files:
                if not self.is_processing:  # 检查是否被用户中断
                    break
                    
                # 更新状态
                self.update_status(f"正在处理 {processed+1}/{total} 张图片: {img_file}")
                
                # 处理图片
                img_path = os.path.join(self.input_dir, img_file)
                category = self.classifier.classify_image(img_path)
                
                # 更新统计
                category_stats[category] = category_stats.get(category, 0) + 1
                
                # 移动文件
                dest_dir = os.path.join(self.output_dir, category)
                dest_path = os.path.join(dest_dir, img_file)
                shutil.copy2(img_path, dest_path)
                
                # 更新进度
                processed += 1
                progress = processed / total
                
                # 更新UI（线程安全）
                self.after(0, lambda p=progress, s=category_stats: self.update_ui(p, s))
                
            # 完成处理
            self.after(0, lambda: self.finalize_processing(total, processed))
            
        except Exception as e:
            # 处理错误
            self.after(0, lambda err=str(e): self.handle_error(err))
    
    def update_ui(self, progress, stats):
        """更新UI（由主线程调用）"""
        self.progress_bar.set(progress)
        
        # 更新统计
        for category, count in stats.items():
            if category in self.category_counts:
                self.category_counts[category].configure(text=str(count))
    
    def update_status(self, text):
        """更新状态栏（线程安全）"""
        self.after(0, lambda t=text: self.status_bar.configure(text=t))
    
    def finalize_processing(self, total, processed):
        """完成处理后的清理工作"""
        self.is_processing = False
        self.select_btn.configure(state="normal")
        self.start_btn.configure(state="normal")
        
        # 更新状态
        if processed == total:
            self.status_bar.configure(text=f"分类完成! 共处理 {processed} 张图片")
            messagebox.showinfo("完成", f"已成功分类 {processed} 张图片")
        else:
            self.status_bar.configure(text=f"处理已中断! 已处理 {processed}/{total} 张图片")
    
    def handle_error(self, error_message):
        """处理错误情况"""
        self.is_processing = False
        self.select_btn.configure(state="normal")
        self.start_btn.configure(state="normal")
        self.status_bar.configure(text=f"处理出错: {error_message}")
        messagebox.showerror("错误", f"处理图片时出错: {error_message}")
    
    def open_output_folder(self):
        """打开输出文件夹"""
        try:
            # 根据操作系统选择打开文件夹的命令
            if sys.platform == 'darwin':  # macOS
                os.system(f'open "{os.path.abspath(self.output_dir)}"')
            elif sys.platform == 'win32':  # Windows
                os.system(f'explorer "{os.path.abspath(self.output_dir)}"')
            else:  # Linux
                os.system(f'xdg-open "{os.path.abspath(self.output_dir)}"')
        except Exception as e:
            messagebox.showerror("错误", f"无法打开输出文件夹: {str(e)}")

    def quit(self):
        """退出应用"""
        if self.is_processing:
            if messagebox.askyesno("确认", "正在处理图片，确定要退出吗？"):
                self.is_processing = False
                super().quit()
        else:
            super().quit()


if __name__ == "__main__":
    # 消息提示
    if not HAS_DND:
        print("\n\u6ce8意: 拖放功能已禁用。程序将仅支持点击选择图片。")
        print("\u5982需启用拖放功能，您可能需要安装TkDND库。")
        print("\u5bf9于macOS，请参考: https://github.com/petasis/tkdnd\n")
    
    app = ImageClassifierApp()
    app.mainloop()
