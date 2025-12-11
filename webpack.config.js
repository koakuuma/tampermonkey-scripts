const fs = require('fs');
const path = require('path');
const semver = require('semver');
const webpack = require('webpack');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
// const CopyPlugin = require('copy-webpack-plugin')
const packageInfo = require('./package.json');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** 自动扫描 src/scripts 目录下的所有脚本入口 */
function getScriptEntries()
{
  const scriptsDir = path.join(__dirname, 'src/scripts');
  const entries = {};

  // 检查是否指定了特定脚本（通过环境变量 SCRIPT）
  const targetScript = process.env.SCRIPT;

  // 读取 src/scripts 目录
  if (fs.existsSync(scriptsDir))
  {
    const scriptFolders = fs.readdirSync(scriptsDir, { withFileTypes: true });

    scriptFolders.forEach(dirent =>
    {
      if (dirent.isDirectory())
      {
        const scriptName = dirent.name;

        // 如果指定了特定脚本，只编译该脚本
        if (targetScript && scriptName !== targetScript)
        {
          return;
        }

        const indexPath = path.join(scriptsDir, scriptName, 'index.ts');

        // 检查是否存在 index.ts
        if (fs.existsSync(indexPath))
        {
          entries[scriptName] = `./src/scripts/${scriptName}`;
        }
      }
    });
  }

  return entries;
}

/** 获取所有安装的依赖版本 */
function getPkgDepsVersion()
{
  const deps = {
    ...packageInfo.devDependencies,
    ...packageInfo.dependencies,
  };
  for (const pkgName in deps)
  {
    if (hasOwn(deps, pkgName))
    {
      const semverVersion = deps[pkgName];
      deps[pkgName] = semver.coerce(semverVersion).version;
    }
  }
  return deps;
}

const depsVersion = getPkgDepsVersion();

function getScriptHeader(filename, argvMode)
{
  const jsonFilepath = path.join(__dirname, 'src/scripts', filename, 'index.json');
  const jsFilepath = path.join(__dirname, './src/scripts-header', `${filename}.js`);
  const isProd = argvMode === 'production';

  // 优先读取json配置
  if (fs.existsSync(jsonFilepath))
  {
    const headerJson = require(jsonFilepath);
    const lines = ['// ==UserScript=='];
    const keyPadding = 12;

    const formatLine = (key, value) => `// @${key.padEnd(keyPadding)} ${value}`;

    for (const key in headerJson)
    {
      if (key === 'prod') continue;

      const value = headerJson[key];
      if (Array.isArray(value))
      {
        value.forEach(item => lines.push(formatLine(key, item)));
      }
      else
      {
        lines.push(formatLine(key, value));
      }
    }

    if (isProd && headerJson.prod)
    {
      for (const key in headerJson.prod)
      {
        lines.push(formatLine(key, headerJson.prod[key]));
      }
    }

    lines.push('// ==/UserScript==');
    return lines.join('\n');
  }

  // 兼容旧的js配置
  if (fs.existsSync(jsFilepath))
  {
    return require(jsFilepath)(isProd, depsVersion);
  }

  return '';
}

module.exports = (env, argv) => ({
  devtool: false,
  entry: getScriptEntries(),
  output: {
    path: path.join(__dirname, 'dist'),
    publicPath: '/',
  },
  externals: {
    vue: 'Vue',
    viewerjs: 'Viewer',
    'crypto-js/md5': 'CryptoJS.MD5',
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.join(__dirname, './src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|ts|tsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
      {
        test: /\.s[ac]ss$/i,
        exclude: [
          /\.lazy\.s[ac]ss$/i,
          /\.string\.s[ac]ss$/i,
        ],
        use: ['style-loader', 'css-loader', 'postcss-loader', 'sass-loader'],
      },
      {
        test: /\.lazy\.s[ac]ss$/i,
        use: [
          { loader: 'style-loader', options: { injectType: 'lazyStyleTag' } },
          'css-loader', 'postcss-loader', 'sass-loader',
        ],
      },
      {
        test: /\.string\.s[ac]ss$/i,
        use: ['css-loader', 'postcss-loader', 'sass-loader'],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin({
      // 如果指定了特定脚本，只清理该脚本的输出文件
      cleanOnceBeforeBuildPatterns: process.env.SCRIPT
        ? [`${process.env.SCRIPT}.js`]
        : ['**/*'], // 否则清理所有文件
    }),
    new webpack.BannerPlugin({
      banner: file => getScriptHeader(file.chunk.name, argv.mode),
      raw: true,
      entryOnly: true,
    }),
    // new CopyPlugin({
    //   patterns: [
    //     { from: path.join(__dirname, './src/helpers/toast.js') },
    //   ],
    // }),
  ],
  // 遵守Greasy Fork代码规定，不做最小化处理
  // https://greasyfork.org/zh-CN/help/code-rules
  optimization: {
    minimize: false,
    minimizer: [new TerserPlugin({
      extractComments: false,
      terserOptions: {
        output: {
          comments: true,
        },
      },
    })],
  },
  devServer: {
    port: 8886,
    static: [
      {
        directory: path.resolve(__dirname, 'dist'),
      },
    ],
  },
});
