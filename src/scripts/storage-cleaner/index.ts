// 网页存储清理器
// 清空当前网页的所有存储数据（localStorage、sessionStorage、IndexedDB、Cookies等）

// Tampermonkey API 类型声明
declare function GM_registerMenuCommand(caption: string, commandFunc: () => void): void;

(function ()
{
  'use strict';

  // 计算存储数据大小（估算值，单位：字节）
  function calculateStorageSize(): number
  {
    let totalSize = 0;

    try
    {
      // 计算 localStorage 大小
      for (let key in localStorage)
      {
        if (localStorage.hasOwnProperty(key))
        {
          totalSize += key.length + (localStorage[key]?.length || 0);
        }
      }

      // 计算 sessionStorage 大小
      for (let key in sessionStorage)
      {
        if (sessionStorage.hasOwnProperty(key))
        {
          totalSize += key.length + (sessionStorage[key]?.length || 0);
        }
      }

      // 计算 cookies 大小
      totalSize += document.cookie.length;
    }
    catch (error)
    {
      console.error('计算存储大小时出错:', error);
    }

    // 每个字符按2字节计算（Unicode）
    return totalSize * 2;
  }

  // 格式化字节大小
  function formatBytes(bytes: number): string
  {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes.toFixed(2) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // 清空所有存储
  async function clearAllStorage(): Promise<void>
  {
    let clearedItems: string[] = [];

    try
    {
      // 清空 localStorage
      const localStorageCount = localStorage.length;
      if (localStorageCount > 0)
      {
        localStorage.clear();
        clearedItems.push(`localStorage (${localStorageCount} 项)`);
      }

      // 清空 sessionStorage
      const sessionStorageCount = sessionStorage.length;
      if (sessionStorageCount > 0)
      {
        sessionStorage.clear();
        clearedItems.push(`sessionStorage (${sessionStorageCount} 项)`);
      }

      // 清空 cookies
      const cookies = document.cookie.split(';');
      let cookieCount = 0;
      for (let cookie of cookies)
      {
        const eqPos = cookie.indexOf('=');
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        if (name)
        {
          // 尝试多种方式删除 cookie
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + location.hostname;
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.' + location.hostname;
          cookieCount++;
        }
      }
      if (cookieCount > 0)
      {
        clearedItems.push(`Cookies (${cookieCount} 项)`);
      }

      // 清空 IndexedDB
      if (window.indexedDB)
      {
        try
        {
          const databases = await window.indexedDB.databases();
          if (databases && databases.length > 0)
          {
            for (let db of databases)
            {
              if (db.name)
              {
                window.indexedDB.deleteDatabase(db.name);
              }
            }
            clearedItems.push(`IndexedDB (${databases.length} 个数据库)`);
          }
        }
        catch (error)
        {
          console.warn('清空 IndexedDB 时出错:', error);
        }
      }

      // 清空 Cache Storage
      if ('caches' in window)
      {
        try
        {
          const cacheNames = await caches.keys();
          if (cacheNames.length > 0)
          {
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            clearedItems.push(`Cache Storage (${cacheNames.length} 个缓存)`);
          }
        }
        catch (error)
        {
          console.warn('清空 Cache Storage 时出错:', error);
        }
      }

      console.log('✅ 存储清理完成:', clearedItems.join(', '));
    }
    catch (error)
    {
      console.error('❌ 清空存储时出错:', error);
      throw error;
    }
  }

  // 显示存储大小的菜单命令
  function registerShowSizeCommand(): void
  {
    const size = calculateStorageSize();
    const sizeText = formatBytes(size);

    GM_registerMenuCommand(`📊 存储数据 ${sizeText}`, () =>
    {
      const confirmMsg = `当前网页存储数据大小约为：${sizeText}\n\n包括：\n` +
        `• localStorage: ${localStorage.length} 项\n` +
        `• sessionStorage: ${sessionStorage.length} 项\n` +
        `• Cookies: ${document.cookie.split(';').filter(c => c.trim()).length} 项\n\n` +
        `是否要清空所有存储数据？`;

      if (confirm(confirmMsg))
      {
        clearAllStorage()
          .then(() =>
          {
            alert('✅ 存储内容已清空！\n\n页面将在3秒后自动刷新...');
            setTimeout(() =>
            {
              location.reload();
            }, 3000);
          })
          .catch((error) =>
          {
            alert('❌ 清空存储时出错：' + error.message);
          });
      }
    });
  }

  // 直接清空存储的菜单命令
  function registerClearCommand(): void
  {
    GM_registerMenuCommand('🗑️ 清空所有存储', () =>
    {
      const size = calculateStorageSize();
      const sizeText = formatBytes(size);

      const confirmMsg = `即将清空当前网页的所有存储数据！\n\n` +
        `当前存储大小：${sizeText}\n` +
        `• localStorage: ${localStorage.length} 项\n` +
        `• sessionStorage: ${sessionStorage.length} 项\n` +
        `• Cookies: ${document.cookie.split(';').filter(c => c.trim()).length} 项\n\n` +
        `⚠️ 此操作不可恢复，确定要继续吗？`;

      if (confirm(confirmMsg))
      {
        clearAllStorage()
          .then(() =>
          {
            alert('✅ 存储内容已清空！\n\n页面将在3秒后自动刷新...');
            setTimeout(() =>
            {
              location.reload();
            }, 3000);
          })
          .catch((error) =>
          {
            alert('❌ 清空存储时出错：' + error.message);
          });
      }
    });
  }

  // 导出存储数据的菜单命令
  function registerExportCommand(): void
  {
    GM_registerMenuCommand('💾 导出存储数据', () =>
    {
      try
      {
        const exportData = {
          url: location.href,
          timestamp: new Date().toISOString(),
          localStorage: { ...localStorage },
          sessionStorage: { ...sessionStorage },
          cookies: document.cookie
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `storage-backup-${location.hostname}-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('✅ 存储数据已导出');
      }
      catch (error)
      {
        console.error('❌ 导出存储数据时出错:', error);
        alert('导出失败：' + (error as Error).message);
      }
    });
  }

  // 初始化
  function init(): void
  {
    try
    {
      // 注册菜单命令
      registerShowSizeCommand();
      registerClearCommand();
      registerExportCommand();

      console.log('🧹 网页存储清理器已加载');
      console.log(`📊 当前存储大小：${formatBytes(calculateStorageSize())}`);
    }
    catch (error)
    {
      console.error('初始化存储清理器时出错:', error);
    }
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading')
  {
    document.addEventListener('DOMContentLoaded', init);
  }
  else
  {
    init();
  }
})();
