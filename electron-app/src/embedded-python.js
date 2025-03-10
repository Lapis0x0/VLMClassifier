/**
 * 嵌入式Python管理模块
 * 负责管理预打包的Python解释器
 */
const path = require('path');
const fs = require('fs-extra');
const { app } = require('electron');
const { spawn } = require('child_process');
const log = require('electron-log');
const os = require('os');
const isDev = require('electron-is-dev');

// 平台特定的配置
const getPlatformConfig = () => {
  switch (process.platform) {
    case 'win32':
      return {
        pythonDir: 'python-windows',
        pythonExe: 'python.exe'
      };
    case 'darwin':
      if (process.arch === 'arm64') {
        return {
          pythonDir: 'python-macos-arm64',
          pythonExe: 'bin/python3'
        };
      } else {
        return {
          pythonDir: 'python-macos-x64',
          pythonExe: 'bin/python3'
        };
      }
    case 'linux':
      return {
        pythonDir: 'python-linux',
        pythonExe: 'bin/python3'
      };
    default:
      throw new Error(`不支持的平台: ${process.platform}`);
  }
};

// 获取嵌入式Python路径
const getEmbeddedPythonPath = () => {
  const { pythonDir, pythonExe } = getPlatformConfig();
  
  // 在开发环境中，使用系统的Python
  if (isDev) {
    // 尝试使用系统的Python
    const pythonCommands = ['python3', 'python'];
    for (const cmd of pythonCommands) {
      try {
        const result = require('child_process').spawnSync(cmd, ['--version']);
        if (result.status === 0) {
          log.info(`开发环境使用系统 Python: ${cmd}`);
          return cmd;
        }
      } catch (err) {}
    }
  }
  
  // 在生产环境中，使用预打包的Python
  let pythonPath;
  
  // 尝试多个可能的路径
  const possiblePaths = [
    // 优先使用资源目录中的Python
    process.resourcesPath ? path.join(process.resourcesPath, 'python', pythonDir, pythonExe) : null,
    // 如果不存在，使用应用目录中的Python
    path.join(app.getAppPath(), 'python', pythonDir, pythonExe),
    // 如果不存在，使用应用父目录中的Python
    path.join(path.dirname(app.getAppPath()), 'python', pythonDir, pythonExe),
    // 如果不存在，使用临时目录中的Python
    path.join(app.getPath('temp'), 'vlmclassifier-python', pythonDir, pythonExe)
  ].filter(Boolean);
  
  // 检查所有可能的路径
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        log.info(`找到预打包的Python: ${p}`);
        pythonPath = p;
        break;
      }
    } catch (err) {}
  }
  
  if (!pythonPath) {
    // 如果没有找到预打包的Python，尝试使用系统的Python
    log.warn('未找到预打包的Python，尝试使用系统的Python');
    const pythonCommands = ['python3', 'python'];
    for (const cmd of pythonCommands) {
      try {
        const result = require('child_process').spawnSync(cmd, ['--version']);
        if (result.status === 0) {
          log.info(`使用系统 Python: ${cmd}`);
          return cmd;
        }
      } catch (err) {}
    }
    
    // 如果还是找不到，返回默认值
    log.error('未找到任何可用的Python，使用默认值');
    return process.platform === 'win32' ? 'python' : 'python3';
  }
  
  return pythonPath;
};

// 检查Python是否可用
const isPythonAvailable = async () => {
  try {
    const pythonPath = getEmbeddedPythonPath();
    log.info(`检查Python是否可用: ${pythonPath}`);
    
    // 尝试运行Python命令
    const result = spawn(pythonPath, ['--version']);
    
    return new Promise((resolve) => {
      result.on('close', (code) => {
        if (code === 0) {
          log.info('Python可用');
          resolve(true);
        } else {
          log.warn(`Python不可用，退出码: ${code}`);
          resolve(false);
        }
      });
      
      // 设置超时
      setTimeout(() => {
        log.warn('Python检查超时');
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    log.error(`检查Python失败: ${error.message}`);
    return false;
  }
};

// 使用Python运行脚本
const runPythonScript = async (scriptPath, args = []) => {
  try {
    const pythonPath = getEmbeddedPythonPath();
    
    // 检查Python是否可用
    const available = await isPythonAvailable();
    if (!available) {
      throw new Error('Python不可用');
    }
    
    log.info(`使用Python运行脚本: ${scriptPath}`);
    log.info(`Python路径: ${pythonPath}`);
    log.info(`脚本参数: ${args.join(' ')}`);
    
    // 设置环境变量
    const env = { ...process.env };
    
    // 如果是预打包的Python，设置PYTHONPATH包含脚本目录
    if (pythonPath !== 'python' && pythonPath !== 'python3') {
      const scriptDir = path.dirname(scriptPath);
      if (process.platform === 'win32') {
        env.PYTHONPATH = `${scriptDir};${env.PYTHONPATH || ''}`;
      } else {
        env.PYTHONPATH = `${scriptDir}:${env.PYTHONPATH || ''}`;
      }
      log.info(`设置PYTHONPATH: ${env.PYTHONPATH}`);
    }
    
    // 运行脚本
    return spawn(pythonPath, [scriptPath, ...args], {
      stdio: 'pipe',
      env: env,
      cwd: path.dirname(scriptPath) // 设置工作目录为脚本所在目录
    });
  } catch (error) {
    log.error(`运行Python脚本失败: ${error.message}`);
    throw error;
  }
};

module.exports = {
  runPythonScript,
  getEmbeddedPythonPath,
  isPythonAvailable
};
