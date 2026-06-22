# 1. 换成 Node 22，解决你依赖包报错 (EBADENGINE) 的问题
FROM node:22-bookworm-slim

WORKDIR /app

# 2. 拷贝 package.json
COPY package*.json ./

# 3. 安装系统依赖 (C++ 编译环境和 SpatiaLite)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libsqlite3-mod-spatialite \
    && rm -rf /var/lib/apt/lists/*

# 4. 升级 npm 到最新版，这能大概率解决 esbuild ETXTBSY 的读写竞争报错
RUN npm install -g npm@latest

# 5. 安装依赖
RUN npm install

COPY . .

# 6. 入口脚本（初始化挂载目录 + 配置文件兜底）
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=1145

EXPOSE 1145

# 声明挂载点（数据持久化）
VOLUME ["/app/sessions", "/app/photo", "/app/risk"]

ENTRYPOINT ["docker-entrypoint.sh"]
