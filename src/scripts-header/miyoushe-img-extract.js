module.exports = (isProd) => `// ==UserScript==
// @name         米游社帖子图片链接提取
// @namespace    miyoushe-img-article
// @version      1.0
// @description  提取米游社帖子中的图片链接
// @author       shangxue
// @match        https://www.miyoushe.com/*
// @license      MIT
// @grant        none
// @run-at       document-end
// @homepageURL  https://github.com/shangxueink/tampermonkey-scripts
// @supportURL   https://github.com/shangxueink/tampermonkey-scripts/issues
${isProd ? '// @downloadURL https://github.com/shangxueink/tampermonkey-scripts/raw/main/dist/miyoushe-img-extract.user.js' : ''}
${isProd ? '// @updateURL https://github.com/shangxueink/tampermonkey-scripts/raw/main/dist/miyoushe-img-extract.user.js' : ''}
// ==/UserScript==
`