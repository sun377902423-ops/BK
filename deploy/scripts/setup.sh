#!/bin/bash
# BKSYS 项目部署脚本

echo "🔧 开始设置 BKSYS 远程会诊系统..."

# 检查 Docker 和 Docker Compose 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 创建必要的目录
mkdir -p ./data/postgres
mkdir -p ./data/redis
mkdir -p ./data/orthanc

echo "✅ 目录创建完成"

# 检查环境变量文件
if [ ! -f ../backend/.env ]; then
    echo "⚠️  未找到 .env 文件，正在创建示例文件..."
    cp ../backend/.env.example ../backend/.env
    echo "⚠️  请编辑 ../backend/.env 配置您的环境变量"
fi

echo "✅ 设置完成！运行 'docker compose up -d' 启动服务"
