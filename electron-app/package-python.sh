#!/bin/bash
# 打包Python环境脚本
# 此脚本用于创建可分发的Python环境，包含所有必要的依赖

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}开始打包Python环境...${NC}"

# 检测操作系统和架构
OS="$(uname)"
ARCH="$(uname -m)"

echo -e "${YELLOW}检测到系统: ${OS}, 架构: ${ARCH}${NC}"

# 创建目录
PYTHON_DIR="python"
if [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        PYTHON_SUBDIR="python-macos-arm64"
        PYTHON_URL="https://mirrors.tuna.tsinghua.edu.cn/anaconda/miniconda/Miniconda3-py39_23.5.2-0-MacOSX-arm64.sh"
    else
        PYTHON_SUBDIR="python-macos-x64"
        PYTHON_URL="https://mirrors.tuna.tsinghua.edu.cn/anaconda/miniconda/Miniconda3-py39_23.5.2-0-MacOSX-x86_64.sh"
    fi
elif [ "$OS" = "Linux" ]; then
    PYTHON_SUBDIR="python-linux"
    PYTHON_URL="https://mirrors.tuna.tsinghua.edu.cn/anaconda/miniconda/Miniconda3-py39_23.5.2-0-Linux-x86_64.sh"
else
    echo -e "${RED}不支持的操作系统: ${OS}${NC}"
    exit 1
fi

PYTHON_PATH="${PYTHON_DIR}/${PYTHON_SUBDIR}"
echo -e "${YELLOW}将创建Python环境目录: ${PYTHON_PATH}${NC}"

# 创建目录
mkdir -p "${PYTHON_PATH}"

# 下载Miniconda安装程序
echo -e "${GREEN}下载Miniconda...${NC}"
TEMP_DIR="$(mktemp -d)"
INSTALLER_PATH="${TEMP_DIR}/miniconda.sh"

curl -k -L "${PYTHON_URL}" -o "${INSTALLER_PATH}"

if [ $? -ne 0 ]; then
    echo -e "${RED}下载失败，尝试使用系统Python...${NC}"
    
    # 如果下载失败，尝试使用系统Python
    if command -v python3 &> /dev/null; then
        echo -e "${YELLOW}使用系统Python创建虚拟环境...${NC}"
        python3 -m venv "${PYTHON_PATH}"
        
        # 安装必要的包
        "${PYTHON_PATH}/bin/pip" install --trusted-host pypi.org --trusted-host files.pythonhosted.org fastapi uvicorn pydantic pillow numpy requests python-multipart
    else
        echo -e "${RED}未找到系统Python，无法创建环境${NC}"
        exit 1
    fi
else
    # 安装Miniconda到指定目录
    echo -e "${GREEN}安装Miniconda到 ${PYTHON_PATH}...${NC}"
    bash "${INSTALLER_PATH}" -b -p "${PYTHON_PATH}" -f
    
    # 安装必要的包
    echo -e "${GREEN}安装依赖...${NC}"
    "${PYTHON_PATH}/bin/pip" install --trusted-host pypi.org --trusted-host files.pythonhosted.org fastapi uvicorn pydantic pillow numpy requests python-multipart
fi

# 如果是macOS，需要特殊处理
if [ "$OS" = "Darwin" ]; then
    echo -e "${YELLOW}在macOS上执行特殊处理...${NC}"
    
    # 创建启动脚本
    cat > "${PYTHON_PATH}/bin/python3.sh" << EOF
#!/bin/bash
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
PYTHONHOME="\${DIR}/.."
export PYTHONHOME
export PYTHONPATH="\${PYTHONHOME}/lib/python3.9/site-packages:\${PYTHONPATH}"
exec "\${DIR}/python3" "\$@"
EOF
    
    chmod +x "${PYTHON_PATH}/bin/python3.sh"
fi

# 清理临时文件
rm -rf "${TEMP_DIR}"

echo -e "${GREEN}Python环境打包完成!${NC}"
echo -e "${YELLOW}Python路径: ${PYTHON_PATH}${NC}"
echo -e "${YELLOW}请在electron-builder打包前确保此目录存在${NC}"
