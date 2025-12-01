module.exports = (isProd) => `// ==UserScript==
// @name         Bilibili专栏原图链接提取2024改版
// @namespace    https://github.com/shangxueink
// @version      5.1
// @description  PC端B站专栏图片默认是经压缩过的webp。此脚本帮助用户点击按钮后获取哔哩哔哩专栏中所有原图的直链，方便使用其他工具批量下载原图。
// @author       shangxueink
// @license      MIT
// @match        https://www.bilibili.com/read/cv*
// @match        https://www.bilibili.com/opus/*
// @match        https://t.bilibili.com/*
// @match        https://space.bilibili.com/*/dynamic
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bilibili.com
// @grant        none
// @run-at       document-end
// @acknowledgement 原始脚本由Hui-Shao开发，本脚本在其基础上进行了修改和增强。
// @homepageURL  https://github.com/koakuuma/tampermonkey-scripts
// @supportURL   https://github.com/koakuuma/tampermonkey-scripts/issues
${isProd ? '// @downloadURL https://github.com/koakuuma/tampermonkey-scripts/raw/main/dist/bilibili-img-extract.user.js' : ''}
${isProd ? '// @updateURL https://github.com/koakuuma/tampermonkey-scripts/raw/main/dist/bilibili-img-extract.user.js' : ''}
// ==/UserScript==
`;