"""
生成简单的应用图标
"""
from PIL import Image, ImageDraw, ImageFont
import os

def generate_icon(size=(512, 512), output_path='icons/icon.png'):
    """生成一个简单的VLMClassifier图标"""
    # 创建一个新的图像，使用RGBA模式（带透明度）
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制背景圆形
    circle_diameter = min(size) * 0.9
    circle_radius = circle_diameter / 2
    circle_center = (size[0] / 2, size[1] / 2)
    circle_bbox = (
        circle_center[0] - circle_radius,
        circle_center[1] - circle_radius,
        circle_center[0] + circle_radius,
        circle_center[1] + circle_radius
    )
    
    # 渐变背景（简化版）
    draw.ellipse(circle_bbox, fill=(65, 105, 225, 255))  # 蓝色背景
    
    # 绘制相机图标
    camera_size = circle_diameter * 0.5
    camera_top_left = (
        circle_center[0] - camera_size / 2,
        circle_center[1] - camera_size / 2
    )
    camera_bottom_right = (
        circle_center[0] + camera_size / 2,
        circle_center[1] + camera_size / 2
    )
    
    # 相机主体
    draw.rectangle(
        (camera_top_left[0], camera_top_left[1], camera_bottom_right[0], camera_bottom_right[1]),
        fill=(255, 255, 255, 230),
        outline=(40, 40, 40, 255),
        width=int(circle_diameter * 0.02)
    )
    
    # 相机镜头
    lens_radius = camera_size * 0.25
    lens_center = circle_center
    lens_bbox = (
        lens_center[0] - lens_radius,
        lens_center[1] - lens_radius,
        lens_center[0] + lens_radius,
        lens_center[1] + lens_radius
    )
    draw.ellipse(lens_bbox, fill=(40, 40, 40, 255))
    
    # 内部镜头
    inner_lens_radius = lens_radius * 0.7
    inner_lens_bbox = (
        lens_center[0] - inner_lens_radius,
        lens_center[1] - inner_lens_radius,
        lens_center[0] + inner_lens_radius,
        lens_center[1] + inner_lens_radius
    )
    draw.ellipse(inner_lens_bbox, fill=(80, 80, 80, 255))
    
    # 闪光灯
    flash_radius = lens_radius * 0.4
    flash_center = (camera_top_left[0] + flash_radius * 1.5, camera_top_left[1] + flash_radius * 1.5)
    flash_bbox = (
        flash_center[0] - flash_radius,
        flash_center[1] - flash_radius,
        flash_center[0] + flash_radius,
        flash_center[1] + flash_radius
    )
    draw.ellipse(flash_bbox, fill=(255, 240, 200, 255))
    
    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 保存图像
    img.save(output_path)
    print(f"图标已生成: {output_path}")
    
    # 为不同平台生成不同尺寸的图标
    sizes = [16, 32, 64, 128, 256]
    for s in sizes:
        resized = img.resize((s, s), Image.LANCZOS)
        size_output_path = os.path.join(os.path.dirname(output_path), f"icon_{s}x{s}.png")
        resized.save(size_output_path)
        print(f"生成尺寸 {s}x{s} 图标: {size_output_path}")

if __name__ == "__main__":
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, 'icons', 'icon.png')
    generate_icon(output_path=output_path)
