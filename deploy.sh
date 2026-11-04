#!/usr/bin/env bash
# 路演陪练 · 服务器一键部署脚本
# 用法：进入项目目录（本文件所在目录），执行  bash deploy.sh
# 需要：Linux 服务器 + Node.js 18+；默认端口 3000（可用 PORT=xxx bash deploy.sh 改）

set -e
cd "$(dirname "$0")"

PORT=${PORT:-3000}

# 0. 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[×] 未检测到 Node.js，请先安装（任选一条，需要 sudo）："
  echo "    Ubuntu/Debian:  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  echo "    CentOS/TencentOS: curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
  exit 1
fi
echo "[✓] Node $(node -v)"

# 1. 检查 AI key（缺失不阻塞，走演示模式）
if [ ! -f .env.local ] || ! grep -q "^DEEPSEEK_API_KEY=sk" .env.local; then
  echo "[!] 警告：.env.local 中没有有效的 DEEPSEEK_API_KEY，将运行在演示模式（内置模拟数据）"
  echo "    补 key 方法：echo 'DEEPSEEK_API_KEY=sk-你的key' > .env.local 然后重新执行本脚本"
fi

# 2. 安装依赖 + 构建
echo "[1/2] 安装依赖…"
npm install --no-audit --no-fund
echo "[2/2] 构建…"
npm run build

# 3. 启动（有 pm2 用 pm2，否则 nohup）
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete luyan-peilian >/dev/null 2>&1 || true
  PORT=$PORT pm2 start npm --name luyan-peilian -- start
  pm2 save >/dev/null 2>&1 || true
  echo "[✓] pm2 启动完成。设置开机自启：pm2 startup（按提示执行）"
else
  echo "[i] 未安装 pm2，使用 nohup 启动（服务器重启后需重新执行本脚本；建议 npm i -g pm2）"
  PORT=$PORT nohup npm start > app.log 2>&1 &
  sleep 3
fi

echo ""
echo "=========================================="
echo " 部署完成！访问地址: http://服务器IP:${PORT}"
echo " 查看日志: tail -f app.log （或 pm2 logs luyan-peilian）"
echo " 更新代码后重新部署: 重新执行 bash deploy.sh"
echo "=========================================="
