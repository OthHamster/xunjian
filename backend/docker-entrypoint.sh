#!/bin/sh
set -e

# ============================================
# 智能巡检系统 Docker 入口脚本
# 负责：挂载目录初始化、配置文件兜底、启动服务
# ============================================

DATA_DIRS="sessions photo risk"

echo "=== 检查数据目录 ==="
for dir in $DATA_DIRS; do
  if [ ! -d "/app/$dir" ]; then
    echo "  创建目录: /app/$dir"
    mkdir -p "/app/$dir"
  else
    echo "  ✓ /app/$dir 已存在"
  fi
done

echo "=== 检查配置文件 ==="
if [ ! -f "/app/config.json" ]; then
  echo "  ⚠ 未找到 config.json，生成默认配置"
  cat > /app/config.json << 'CONFEOF'
{
  "port": 1145
}
CONFEOF
  echo "  ✓ 已生成默认 config.json"
else
  echo "  ✓ config.json 已存在"
fi

echo "=== 检查数据库文件 ==="
if [ ! -f "/app/mydatabase.db" ]; then
  echo "  ℹ mydatabase.db 不存在，首次启动时将自动创建"
else
  echo "  ✓ mydatabase.db 已存在"
fi

echo "=== 启动应用 ==="
exec node server.js
