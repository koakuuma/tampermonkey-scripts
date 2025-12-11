# 构建说明

## 编译所有脚本

```bash
# 开发模式（带 watch）
npm run dev
# 或
yarn dev

# 生产模式
npm run build
# 或
yarn build
```

## 编译单个脚本

直接在 build 命令后面指定脚本名称即可：

```bash
# 使用 npm
npm run build <脚本名称>

# 使用 yarn（推荐）
yarn build <脚本名称>
```

### 示例

```bash
# 编译 asmr-channel-swap 脚本
yarn build asmr-channel-swap

# 编译 bilibili-img-extract 脚本
yarn build bilibili-img-extract

# 编译 gateway-auto-login 脚本
yarn build gateway-auto-login
```

## 可用的脚本名称

- `asmr-channel-swap` - ASMR音频声道反转
- `bilibili-img-extract` - Bilibili专栏原图链接提取
- `gateway-auto-login` - 网关自动登录
- `koishi-market-redirector` - Koishi市场重定向
- `miyoushe-img-extract` - 米游社图片提取

## 输出目录

所有编译后的脚本都会输出到 `dist` 目录。
