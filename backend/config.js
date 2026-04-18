const fs = require("fs");
const path = require("path");

const configPath = path.join(process.cwd(), "config.json");
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

module.exports = currentConfig;
