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

  // 读取 src/scripts 目录
  if (fs.existsSync(scriptsDir))
  {
    const scriptFolders = fs.readdirSync(scriptsDir, { withFileTypes: true });

    scriptFolders.forEach(dirent =>
    {
      if (dirent.isDirectory())
      {
        const scriptName = dirent.name;
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
  const filepath = path.join(__dirname, './src/scripts-header', `${filename}.js`);
  const isProd = argvMode === 'production';
  return fs.existsSync(filepath) ? require(filepath)(isProd, depsVersion) : '';
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
    new CleanWebpackPlugin(), // 默认依赖 output path
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
