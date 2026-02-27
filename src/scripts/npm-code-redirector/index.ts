// NPM Code Tab Redirector
// 在 npmjs.com 的 package 页面点击 Code 按钮时自动跳转到 npm-package-editor

(function ()
{
  'use strict';

  function extractPackageName(): string | null
  {
    const match = window.location.pathname.match(/^\/package\/(.+)/);
    if (!match) return null;
    // 去掉末尾可能的斜杠，但保留 @scope/package 中的斜杠
    return match[1].replace(/\/$/, '');
  }

  function handleCodeTabClick(e: MouseEvent): void
  {
    const target = e.target as HTMLElement;
    const codeLink = target.closest('a[href*="activeTab=code"]');

    if (codeLink)
    {
      const packageName = extractPackageName();
      if (packageName)
      {
        e.preventDefault();
        e.stopPropagation();
        const redirectUrl = `https://koakuuma.github.io/npm-package-editor/?npmpackagename=${encodeURIComponent(packageName)}`;
        window.location.href = redirectUrl;
      }
    }
  }

  document.addEventListener('click', handleCodeTabClick, true);
})();
