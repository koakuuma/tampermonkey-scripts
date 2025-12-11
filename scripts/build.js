const { execSync } = require('node:child_process');

// 获取命令行参数（脚本名称）
const scriptName = process.argv[2];

// 构建 webpack 命令
let command = 'webpack --mode=production --progress';

// 如果指定了脚本名称，使用 cross-env 设置环境变量
if (scriptName)
{
  command = `cross-env SCRIPT=${scriptName} ${command}`;
  console.log(`正在编译脚本: ${scriptName}`);
} else
{
  console.log('正在编译所有脚本...');
}

try
{
  // 执行命令
  execSync(command, { stdio: 'inherit' });
} catch (error)
{
  process.exit(1);
}