// NPM Code Tab Redirector
// 在 npmjs.com 的 package 页面点击 Code 按钮时自动跳转到 npm-package-editor

(function ()
{
  'use strict';

  function extractPackageName(): string | null
  {
    const match = window.location.pathname.match(/^\/package\/(.+?)(?:\/|$)/);
    return match ? match[1] : null;
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
