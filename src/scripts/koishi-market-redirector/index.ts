// Koishi Market Registry Redirector
// 将 Koishi 市场注册表请求重定向到多个备用镜像源

(function ()
{
  'use strict';

  // Check if the script should be disabled for this session
  if (sessionStorage.getItem('disableMarketRedirectorOnce') === 'true')
  {
    sessionStorage.removeItem('disableMarketRedirectorOnce');
    console.log('[Koishi Market Registry Redirector] Script disabled for this session. It will be re-enabled on the next navigation.');
    return;
  }

  const currentPath = window.location.pathname;
  const currentSearch = window.location.search;

  if (currentPath.startsWith('/market') && !currentPath.startsWith('/zh-CN/market'))
  {
    const newUrl = window.location.origin + '/zh-CN' + currentPath + currentSearch;
    window.location.replace(newUrl);
    return;
  }

  const normalizeUrl = (url: string) =>
  {
    return url.replace(/\/+$/, '');
  };

  interface MirrorConfig
  {
    url: string;
    useProxy: boolean;
  }

  interface Config
  {
    sourceUrl: string;
    mirrorUrls: MirrorConfig[];
    currentMirrorIndex: number;
    debug: boolean;
    requestTimeout: number;
    disableCache: boolean;
    useProxy: boolean;
    proxyUrl: string;
  }

  const DEFAULT_CONFIG: Config = {
    sourceUrl: normalizeUrl('registry.koishi.chat/index.json'),
    mirrorUrls: [
      { url: 'https://gitee.com/shangxueink/koishi-registry-aggregator/raw/gh-pages/market.json', useProxy: true },
      { url: 'https://shangxueink.github.io/koishi-registry-aggregator/market.json', useProxy: false },
      { url: 'https://koishi-registry.yumetsuki.moe/index.json', useProxy: false },
      { url: 'https://cdn.jsdmirror.com/gh/shangxueink/koishi-registry-aggregator@gh-pages/market.json', useProxy: false },
      { url: 'https://cdn.jsdelivr.net/gh/shangxueink/koishi-registry-aggregator@gh-pages/market.json', useProxy: false },
    ],
    currentMirrorIndex: 0,
    debug: false,
    requestTimeout: 5000,
    disableCache: true,
    useProxy: true,
    proxyUrl: 'https://web-proxy.apifox.cn/api/v1/request',
  };

  const savedConfig = JSON.parse(localStorage.getItem('koishiMarketConfig') || '{}');
  const CONFIG: Config = { ...DEFAULT_CONFIG, ...savedConfig };

  let registryData: any = null;

  const log = function (...args: any[])
  {
    if (CONFIG.debug)
    {
      console.log('[Koishi Market Registry Redirector]', ...args);
    }
  };

  const error = function (...args: any[])
  {
    console.error('[Koishi Market Registry Redirector ERROR]', ...args);
  };

  const getCurrentMirrorUrl = function ()
  {
    const currentMirror = CONFIG.mirrorUrls[CONFIG.currentMirrorIndex];
    return currentMirror ? currentMirror.url : 'N/A';
  };

  const requestWithProxy = async function (targetUrl: string, options: RequestInit)
  {
    log('[Concurrent] 使用代理请求:', targetUrl);
    try
    {
      const response = await originalFetch.call(window, CONFIG.proxyUrl, {
        method: 'POST',
        headers: {
          'api-u': targetUrl,
          'api-o0': `method=GET, timings=true, timeout=${CONFIG.requestTimeout}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: options.signal,
      });

      if (!response.ok)
      {
        throw new Error(`代理请求失败: ${response.status} ${response.statusText}`);
      }

      const proxyData = await response.text();
      const mockResponse = new Response(proxyData, {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
      });

      log('[Concurrent] 代理请求成功:', targetUrl);
      return mockResponse;
    } catch (e)
    {
      error('[Concurrent] 代理请求失败:', targetUrl, e);
      throw e;
    }
  };

  const fetchFromFastestMirror = (input: RequestInfo, init?: RequestInit) =>
  {
    const promises = CONFIG.mirrorUrls.map((mirror, index) =>
    {
      return new Promise<{ response: Response; index: number; }>((resolve, reject) =>
      {
        const controller = new AbortController();
        const timeoutId = setTimeout(() =>
        {
          controller.abort();
          reject(new Error(`Request to ${mirror.url} timed out`));
        }, CONFIG.requestTimeout);

        const { url, useProxy } = mirror;

        const executeFetch = async () =>
        {
          try
          {
            const fetchOptions: RequestInit = {
              ...(init || {}),
              cache: CONFIG.disableCache ? 'no-store' : 'default',
              signal: controller.signal,
            };

            const response = useProxy
              ? await requestWithProxy(url, fetchOptions)
              : await originalFetch.call(window, url, fetchOptions);

            clearTimeout(timeoutId);

            if (!response.ok)
            {
              throw new Error(`Request to ${url} failed with status: ${response.status}`);
            }

            log(`[Concurrent] Success from: ${url}`);
            resolve({ response, index });
          } catch (err)
          {
            clearTimeout(timeoutId);
            error(`[Concurrent] Failed for ${url}:`, (err as Error).message);
            reject(err);
          }
        };

        executeFetch();
      });
    });

    return Promise.any(promises)
      .then(({ response, index }) =>
      {
        const winningMirror = CONFIG.mirrorUrls[index];
        log(`Fastest mirror was: ${winningMirror.url}`);

        CONFIG.currentMirrorIndex = index;
        localStorage.setItem('koishiMarketConfig', JSON.stringify(CONFIG));

        const clonedResponse = response.clone();
        clonedResponse.json().then(data =>
        {
          registryData = data;
          log('Cached registry data from fastest mirror.');
          const mirrorInfoEl = document.querySelector('.mirror-info code');
          if (mirrorInfoEl)
          {
            const proxyStatus = winningMirror.useProxy ? ' (代理)' : '';
            mirrorInfoEl.textContent = `${winningMirror.url}${proxyStatus}`;
          }
          setTimeout(initTimeFixing, 1000);
        }).catch(err =>
        {
          error('Failed to parse registry data from fastest mirror:', err);
        });

        return response;
      })
      .catch(aggregateError =>
      {
        error('All mirror requests failed.', aggregateError.errors);
        return Promise.reject(new Error('All mirror requests failed.'));
      });
  };

  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, async?: boolean, user?: string | null, password?: string | null)
  {
    if (url && typeof url === 'string' && url.includes(CONFIG.sourceUrl))
    {
      log('拦截到 XHR 请求:', url);
      const newUrl = getCurrentMirrorUrl();
      log('重定向到:', newUrl);
      return originalXHROpen.call(this, method, newUrl, async ?? true, user, password);
    }
    return originalXHROpen.call(this, method, url, async ?? true, user, password);
  };

  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit)
  {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
    if (url && normalizeUrl(url).includes(CONFIG.sourceUrl))
    {
      log('拦截到 fetch 请求:', url);
      // 将URL转换为string以匹配RequestInfo类型
      const requestInput: RequestInfo = input instanceof URL ? input.href : input;
      return fetchFromFastestMirror(requestInput, init);
    }
    return originalFetch.call(this, input, init);
  };

  if (navigator.serviceWorker)
  {
    log('检测到 Service Worker 支持，添加消息监听器');
    navigator.serviceWorker.addEventListener('message', function (event)
    {
      if (event.data && event.data.type === 'FETCH' && event.data.url && event.data.url.includes(CONFIG.sourceUrl))
      {
        log('拦截到 Service Worker 请求:', event.data.url);
        event.data.url = getCurrentMirrorUrl();
        log('重定向到:', event.data.url);
      }
    });
  }

  function formatTimeDiff(date: string | Date)
  {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(months / 12);

    if (years > 0) return `${years} 年前`;
    if (months > 0) return `${months} 个月前`;
    if (days > 0) return `${days} 天前`;
    if (hours > 0) return `${hours} 小时前`;
    if (minutes > 0) return `${minutes} 分钟前`;
    return `${seconds} 秒前`;
  }

  function findPluginData(packageName: string)
  {
    if (!registryData || !registryData.objects || !Array.isArray(registryData.objects))
    {
      error('注册表数据不可用或格式不正确');
      return null;
    }

    let shortPackageName = packageName;
    if (typeof packageName === 'string')
    {
      shortPackageName = packageName
        .replace('https://www.npmjs.com/package/', '')
        .replace('https://www.npmjs.com/', '');
    }

    for (const item of registryData.objects)
    {
      if (item && item.package && item.package.name === shortPackageName)
      {
        return item;
      }
    }

    for (const item of registryData.objects)
    {
      if (item && item.package && item.package.name)
      {
        if (item.package.name === shortPackageName || item.package.name.endsWith('/' + shortPackageName))
        {
          return item;
        }
      }
    }

    error('未找到插件数据:', shortPackageName);
    return null;
  }

  function fixTimeDisplay(tooltipElement: HTMLElement, packageName: string)
  {
    try
    {
      const pluginData = findPluginData(packageName);

      if (pluginData && pluginData.package && pluginData.package.date)
      {
        const formattedTime = formatTimeDiff(pluginData.package.date);
        tooltipElement.textContent = formattedTime;
      } else
      {
        error('未找到有效的时间数据');
      }
    } catch (err)
    {
      error('修复时间显示时发生错误:', err);
    }
  }

  function initTimeFixing()
  {
    log('开始初始化时间修复功能');

    const observer = new MutationObserver((mutations) =>
    {
      mutations.forEach((mutation) =>
      {
        if (mutation.addedNodes.length)
        {
          mutation.addedNodes.forEach((node) =>
          {
            if (node.nodeType === 1 && (node as Element).classList && (node as Element).classList.contains('el-popper'))
            {
              const tooltipContent = (node as Element).textContent;
              if (tooltipContent && (tooltipContent.includes('{0}') || tooltipContent.includes('小时前') || tooltipContent.includes('分钟前') || tooltipContent.includes('天前')))
              {
                const hoveredElements = document.querySelectorAll(':hover');
                for (const element of hoveredElements)
                {
                  if (element.tagName === 'A' && (element as HTMLAnchorElement).href && (element as HTMLAnchorElement).href.includes('npmjs.com'))
                  {
                    const tooltipSpan = (node as Element).querySelector('span');
                    if (tooltipSpan)
                    {
                      fixTimeDisplay(tooltipSpan as HTMLElement, (element as HTMLAnchorElement).href);
                    } else
                    {
                      error('未找到工具提示内的span元素');
                    }
                    break;
                  }
                }
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    log('已初始化时间修复功能');
  }

  // 注意：由于脚本太长，这里只包含核心功能
  // 完整的UI配置、镜像选择器等功能需要在实际使用时补充

  log('脚本已启动 —————— 将', CONFIG.sourceUrl, '重定向到多个备用镜像源，当前使用:', getCurrentMirrorUrl());
})();
