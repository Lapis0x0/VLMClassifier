// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Stdio};
use std::io::Read;
use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs::File;

// 分类结果类型
#[derive(Debug, Serialize, Deserialize)]
struct ClassificationResult {
    category: String,
    confidence: f64,
    original_response: String,
}

// 启动Python后端服务
#[tauri::command]
async fn start_backend_service(app_handle: tauri::AppHandle) -> Result<String, String> {
    // 获取应用资源路径
    let resource_path = app_handle.path().resource_dir().unwrap_or_default();
    let backend_path = resource_path.join("backend");
    
    match Command::new("bash")
        .arg("-c")
        .arg(format!("cd '{}' && bash ./start_backend.sh", backend_path.display()))
        .spawn() {
            Ok(_) => Ok("后端服务启动成功".to_string()),
            Err(e) => Err(format!("启动后端服务失败: {}", e))
        }
}

// 使用Python脚本直接分类图片
#[tauri::command]
async fn classify_image(app_handle: tauri::AppHandle, image_path: String) -> Result<ClassificationResult, String> {
    println!("开始分类图片: {}", image_path);
    
    // 检查图片文件是否存在
    let image_path_obj = PathBuf::from(&image_path);
    if !image_path_obj.exists() {
        println!("错误: 图片文件不存在: {}", image_path);
        return Err(format!("图片文件不存在: {}", image_path));
    } else {
        println!("图片文件存在: {}", image_path);
        // 检查文件大小
        match File::open(&image_path_obj) {
            Ok(mut file) => {
                let mut buffer = Vec::new();
                match file.read_to_end(&mut buffer) {
                    Ok(size) => println!("图片文件大小: {} 字节", size),
                    Err(e) => println!("无法读取图片文件: {}", e),
                }
            },
            Err(e) => println!("无法打开图片文件: {}", e),
        }
    }
    
    // 获取应用资源路径
    let resource_path = app_handle.path().resource_dir().unwrap_or_default();
    println!("资源路径: {}", resource_path.display());
    
    let backend_path = resource_path.join("backend");
    println!("后端路径: {}", backend_path.display());
    
    let script_path = backend_path.join("classify_image.py");
    println!("脚本路径: {}", script_path.display());
    
    // 检查脚本是否存在
    if !script_path.exists() {
        println!("错误: 分类脚本不存在: {}", script_path.display());
        
        // 尝试列出后端目录中的文件
        if backend_path.exists() {
            println!("后端目录内容:");
            match std::fs::read_dir(&backend_path) {
                Ok(entries) => {
                    for entry in entries {
                        if let Ok(entry) = entry {
                            println!("  - {}", entry.path().display());
                        }
                    }
                },
                Err(e) => println!("无法读取后端目录: {}", e),
            }
        }
        
        return Err(format!("分类脚本不存在: {}", script_path.display()));
    } else {
        println!("分类脚本存在: {}", script_path.display());
    }
    
    // 尝试使用python3而不是python
    println!("尝试使用python3执行脚本...");
    let output = Command::new("python3")
        .arg(script_path.to_str().unwrap())
        .arg(&image_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();
    
    // 如果python3失败，尝试使用python
    let output = match output {
        Ok(output) => {
            println!("使用python3执行成功");
            output
        },
        Err(e) => {
            println!("使用python3执行失败: {}, 尝试使用python...", e);
            Command::new("python")
                .arg(script_path.to_str().unwrap())
                .arg(&image_path)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .map_err(|e| format!("执行分类脚本失败: {}", e))?
        }
    };
    
    // 检查执行结果
    println!("脚本执行状态: {}", output.status);
    println!("脚本标出输出: {}", String::from_utf8_lossy(&output.stdout));
    println!("脚本错误输出: {}", String::from_utf8_lossy(&output.stderr));
    
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("分类脚本执行失败: {}", error));
    }
    
    // 解析输出结果
    let result = String::from_utf8_lossy(&output.stdout);
    println!("分类结果: {}", result);
    
    // 尝试解析JSON
    match serde_json::from_str::<ClassificationResult>(&result) {
        Ok(parsed) => {
            println!("解析成功: {:?}", parsed);
            Ok(parsed)
        },
        Err(e) => {
            println!("解析失败: {}", e);
            // 尝试创建一个默认结果
            if !result.trim().is_empty() {
                // 如果有输出但不是JSON格式，尝试提取类别
                let default_result = ClassificationResult {
                    category: result.trim().to_string(),
                    confidence: 0.0,
                    original_response: result.trim().to_string(),
                };
                println!("创建默认结果: {:?}", default_result);
                Ok(default_result)
            } else {
                Err(format!("解析分类结果失败: {}", e))
            }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 在应用启动时启动后端服务
            #[cfg(not(debug_assertions))]
            {
                // 使用clone来避免生命周期问题
                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    println!("正在启动后端服务...");
                    // 使用简化的方式启动后端服务
                    // 获取应用资源路径
                    let resource_path = app_handle.path().resource_dir().unwrap_or_default();
                    let backend_path = resource_path.join("backend");
                    
                    println!("后端路径: {}", backend_path.display());
                    
                    // 检查后端路径是否存在
                    if !backend_path.exists() {
                        eprintln!("错误: 后端路径不存在: {}", backend_path.display());
                        // 尝试查找资源目录下的所有文件
                        if resource_path.exists() {
                            println!("资源目录内容:");
                            match std::fs::read_dir(&resource_path) {
                                Ok(entries) => {
                                    for entry in entries {
                                        if let Ok(entry) = entry {
                                            println!("  - {}", entry.path().display());
                                        }
                                    }
                                },
                                Err(e) => eprintln!("无法读取资源目录: {}", e),
                            }
                        }
                        return;
                    }
                    
                    // 检查启动脚本是否存在
                    let start_script = backend_path.join("start_backend.sh");
                    if !start_script.exists() {
                        eprintln!("错误: 启动脚本不存在: {}", start_script.display());
                        // 列出后端目录中的文件
                        println!("后端目录内容:");
                        match std::fs::read_dir(&backend_path) {
                            Ok(entries) => {
                                for entry in entries {
                                    if let Ok(entry) = entry {
                                        println!("  - {}", entry.path().display());
                                    }
                                }
                            },
                            Err(e) => eprintln!("无法读取后端目录: {}", e),
                        }
                        return;
                    }
                    
                    println!("尝试启动后端服务: {}", start_script.display());
                    
                    // 使用更详细的命令启动后端服务
                    match Command::new("bash")
                        .arg("-c")
                        .arg(format!("cd '{}' && bash ./start_backend.sh", backend_path.display()))
                        .spawn() {
                            Ok(_) => println!("后端服务启动成功"),
                            Err(e) => eprintln!("启动后端服务失败: {}", e)
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![start_backend_service, classify_image])
        .run(tauri::generate_context!())
        .expect("运行应用程序时出错");
}
