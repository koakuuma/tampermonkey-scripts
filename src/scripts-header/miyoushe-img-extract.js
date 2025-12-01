module.exports = (isProd) => `// ==UserScript==
// @name         米游社帖子图片链接提取
// @namespace    https://github.com/shangxueink
// @version      1.2
// @description  提取米游社帖子中的图片链接
// @author       shangxueink
// @match        https://www.miyoushe.com/*
// @license      MIT
// @grant        none
// @run-at       document-end
// @homepageURL  https://github.com/koakuuma/tampermonkey-scripts
// @supportURL   https://github.com/koakuuma/tampermonkey-scripts/issues
${isProd ? '// @downloadURL https://github.com/koakuuma/tampermonkey-scripts/raw/main/dist/miyoushe-img-extract.user.js' : ''}
${isProd ? '// @updateURL https://github.com/koakuuma/tampermonkey-scripts/raw/main/dist/miyoushe-img-extract.user.js' : ''}
// ==/UserScript==
`;