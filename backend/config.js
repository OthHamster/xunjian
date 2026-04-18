const fs = require("fs");
const path = require("path");

// In pkg executable mode, read/write config beside the exe; otherwise use backend/config.json.
const runtimeBaseDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const configPath = path.join(runtimeBaseDir, "config.json");
const defaultConfig = {
  port: 1145,
};

let currentConfig = null;

if (fs.existsSync(configPath)) {
  // Case A: 文件存在，直接读取
  try {
    const fileContent = fs.readFileSync(configPath, "utf-8");
    currentConfig = JSON.parse(fileContent);
    console.log(`✅ 已加载配置文件: ${configPath}`);
  } catch (err) {
    console.error("❌ 配置文件格式错误，请检查 JSON 语法（注意逗号和双引号）");
    process.exit(1); // 停止程序
  }
} else {
  try {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`⚠️  未找到配置文件，已自动生成: ${configPath}`);
    console.log("⚠️  请修改该文件后重启程序。");

    currentConfig = defaultConfig;
  } catch (err) {
    console.error("❌ 无法生成配置文件，请检查目录权限");
    process.exit(1);
  }
}

const envPort = Number(process.env.PORT);
if (Number.isInteger(envPort) && envPort > 0) {
  currentConfig.port = envPort;
}

module.exports = currentConfig;
