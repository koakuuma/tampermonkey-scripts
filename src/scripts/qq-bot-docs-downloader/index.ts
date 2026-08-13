// QQ 机器人开发文档一键下载
// 读取当前开发文档的侧边栏目录，逐页抓取正文并转换为 Markdown，最后打包为 zip。

declare function GM_addStyle(css: string): void;

interface SidebarLeaf {
  href: string;
  title: string;
  groups: string[];
}

interface DownloadRecord {
  title: string;
  folders: string[];
  outputPath: string;
  url: string;
}

interface DownloadPlan {
  records: DownloadRecord[];
  routeMap: Map<string, string>;
}

interface AppPage {
  regularPath: string;
  relativePath: string;
  title?: string;
}

interface SidebarGroup {
  title?: string;
  path?: string;
  children?: SidebarItem[];
}

type SidebarItem = string | SidebarGroup | [string, string] | SidebarItem[];

interface SidebarWalkLeaf {
  rel: string;
  base: string;
  folders: string[];
  titleOverride?: string;
}

interface SidebarWalkOutput {
  leaves: SidebarWalkLeaf[];
  unknown: unknown[];
}

interface ZipFile {
  path: string;
  content: string;
}

interface DownloadFailure {
  title: string;
  url: string;
  error: string;
}

interface CentralRecord {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  localOffset: number;
}

(function ()
{
  'use strict';

  const ROOT_FOLDER = 'QQ机器人开发文档';
  const CONCURRENCY = 4;
  const FETCH_TIMEOUT_MS = 30000;

  let running = false;
  let button: HTMLButtonElement | null = null;
  let statusBox: HTMLDivElement | null = null;

  GM_addStyle(`
    #qq-bot-doc-downloader {
      position: fixed;
      top: 66px;
      right: 14px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    }

    #qq-bot-doc-downloader .qq-bot-doc-btn {
      appearance: none;
      border: 1px solid #0b6efd;
      background: #0b6efd;
      color: #fff;
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 13px;
      line-height: 18px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
    }

    #qq-bot-doc-downloader .qq-bot-doc-btn:hover:not(:disabled) {
      background: #075cd0;
      border-color: #075cd0;
    }

    #qq-bot-doc-downloader .qq-bot-doc-btn:disabled {
      cursor: wait;
      opacity: 0.7;
    }

    #qq-bot-doc-downloader .qq-bot-doc-status {
      display: none;
      max-width: 320px;
      min-width: 180px;
      padding: 9px 11px;
      border: 1px solid #d9dee7;
      border-radius: 6px;
      background: #fff;
      color: #243247;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
      font-size: 12px;
      line-height: 1.5;
      word-break: break-word;
    }

    #qq-bot-doc-downloader .qq-bot-doc-status.is-error {
      border-color: #f0b5b5;
      background: #fff5f5;
      color: #9b1c1c;
    }
  `);

  function ensureUi(): void
  {
    if (button && document.body.contains(button)) return;

    const container = document.createElement('div');
    container.id = 'qq-bot-doc-downloader';

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'qq-bot-doc-btn';
    button.textContent = '下载文档';
    button.title = '下载当前 QQ 机器人开发文档目录为 Markdown 压缩包';
    button.addEventListener('click', () => { void handleDownload(); });

    statusBox = document.createElement('div');
    statusBox.className = 'qq-bot-doc-status';

    container.appendChild(button);
    container.appendChild(statusBox);
    document.body.appendChild(container);
  }

  function setStatus(message: string, isError?: boolean): void
  {
    if (!statusBox) return;
    if (!message)
    {
      statusBox.style.display = 'none';
      statusBox.textContent = '';
      statusBox.classList.remove('is-error');
      return;
    }
    statusBox.style.display = 'block';
    statusBox.textContent = message;
    statusBox.classList.toggle('is-error', Boolean(isError));
  }

  function delay(ms: number): Promise<void>
  {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function sanitizeName(name: string): string
  {
    return String(name || '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^\.+|\.+$/g, '')
      .trim()
      .slice(0, 100) || '未命名';
  }

  function extractBalanced(text: string, openIndex: number, openChar: string, closeChar: string): string | null
  {
    if (openIndex < 0) return null;

    let depth = 0;
    let inString = false;
    let quote = '';
    let escaped = false;

    for (let i = openIndex; i < text.length; i += 1)
    {
      const char = text[i];

      if (inString)
      {
        if (escaped)
        {
          escaped = false;
        }
        else if (char === '\\')
        {
          escaped = true;
        }
        else if (char === quote)
        {
          inString = false;
        }
        continue;
      }

      if (char === '"' || char === "'" || char === '`')
      {
        inString = true;
        quote = char;
        continue;
      }

      if (char === openChar)
      {
        depth += 1;
      }
      else if (char === closeChar)
      {
        depth -= 1;
        if (depth === 0) return text.slice(openIndex, i + 1);
      }
    }

    return null;
  }

  function extractBalancedAt(text: string, marker: string, openChar: string, closeChar: string): string | null
  {
    const markerIndex = text.indexOf(marker);
    if (markerIndex < 0) return null;
    const openIndex = text.indexOf(openChar, markerIndex);
    return extractBalanced(text, openIndex, openChar, closeChar);
  }

  function parseJsObject<T>(text: string | null): T
  {
    if (!text) throw new Error('未找到页面数据');
    const sanitized = text.replace(/!0/g, 'true').replace(/!1/g, 'false');
    return (new Function(`return (${sanitized});`))() as T;
  }

  function parseSidebarConfig(appText: string): Record<string, SidebarItem[]>
  {
    const sidebarObject = extractBalancedAt(
      appText,
      'sidebar:{"/develop/api-v2/":',
      '{',
      '}'
    );
    return parseJsObject<Record<string, SidebarItem[]>>(sidebarObject);
  }

  function parsePages(appText: string): AppPage[]
  {
    const pagesArray = extractBalancedAt(appText, 'pages:[', '[', ']');
    return parseJsObject<AppPage[]>(pagesArray);
  }

  function isPlainObject(value: unknown): value is Record<string, unknown>
  {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function walkSidebar(items: SidebarItem[], base: string, output: SidebarWalkOutput, groups?: string[]): SidebarWalkOutput
  {
    const currentGroups = groups || [];

    for (const item of items || [])
    {
      if (typeof item === 'string')
      {
        output.leaves.push({
          rel: item,
          base,
          folders: currentGroups.slice()
        });
        continue;
      }

      if (Array.isArray(item))
      {
        if (item.length >= 2 && typeof item[0] === 'string')
        {
          output.leaves.push({
            rel: item[0],
            titleOverride: item[1],
            base,
            folders: currentGroups.slice()
          });
        }
        else if (Array.isArray(item[0]))
        {
          walkSidebar(item as SidebarItem[], base, output, currentGroups);
        }
        else
        {
          output.unknown.push({ type: 'array', item, groups: currentGroups.slice() });
        }
        continue;
      }

      if (isPlainObject(item))
      {
        const group = item as unknown as SidebarGroup;
        if (Array.isArray(group.children))
        {
          const nextGroups = currentGroups.concat(String(group.title || group.path || ''));
          walkSidebar(group.children, base, output, nextGroups);
        }
        else if (typeof group.path === 'string')
        {
          output.leaves.push({
            rel: group.path,
            titleOverride: group.title,
            base,
            folders: currentGroups.slice()
          });
        }
        else if (typeof group.title === 'string')
        {
          output.unknown.push({ type: 'group-without-children', item, groups: currentGroups.slice() });
        }
        else
        {
          output.unknown.push({ type: 'object', item, groups: currentGroups.slice() });
        }
        continue;
      }

      output.unknown.push({ type: 'other', item, groups: currentGroups.slice() });
    }

    return output;
  }

  function normalizeRel(rel: string, base: string): string
  {
    const value = String(rel);
    if (value.startsWith('develop/api-v2/')) return value;
    if (value.startsWith('/develop/api-v2/')) return value.slice(1);
    if (value.startsWith('/wiki/')) return value.slice(6);
    return base + value;
  }

  async function expandSidebar(): Promise<void>
  {
    let guard = 0;
    while (guard < 80)
    {
      const arrow = document.querySelector(
        '.sidebar-group.collapsable > .sidebar-heading:not(.open) .arrow'
      );
      if (!arrow) return;
      (arrow as HTMLElement).click();
      await delay(30);
      guard += 1;
    }
  }

  function collectSidebarLeaves(container: Element, groups: string[], output: SidebarLeaf[]): void
  {
    for (const li of Array.from(container.children))
    {
      if (li.tagName !== 'LI') continue;

      const section = Array.from(li.children).find((el) => (
        el.tagName === 'SECTION' && el.classList.contains('sidebar-group')
      ));
      const link = Array.from(li.children).find((el) => (
        el.tagName === 'A' && el.classList.contains('sidebar-link')
      ));

      if (section)
      {
        const heading = Array.from(section.children).find((el) => (
          el.tagName === 'P' && el.classList.contains('sidebar-heading')
        ));
        const childList = Array.from(section.children).find((el) => (
          el.tagName === 'UL' && el.classList.contains('sidebar-group-items')
        ));
        const title = heading ? heading.textContent.trim().replace(/\s+/g, ' ') : '';
        if (childList)
        {
          collectSidebarLeaves(
            childList,
            title ? groups.concat(title) : groups,
            output
          );
        }
      }
      else if (link)
      {
        const href = link.getAttribute('href');
        if (!href) continue;
        output.push({
          href,
          title: link.textContent.trim().replace(/\s+/g, ' '),
          groups: groups.slice()
        });
      }
    }
  }

  function buildDownloadPlanFromDom(): DownloadPlan
  {
    const sidebarRoot = document.querySelector('.sidebar-links');
    if (!sidebarRoot)
    {
      throw new Error('未找到左侧文档目录，请确认当前页面是 QQ 机器人开发文档页面。');
    }

    const leaves: SidebarLeaf[] = [];
    collectSidebarLeaves(sidebarRoot, [], leaves);

    const records: DownloadRecord[] = [];
    const routeMap = new Map<string, string>();
    const usedHrefs = new Set<string>();
    const usedPaths = new Set<string>();

    for (const leaf of leaves)
    {
      let url: URL;
      try
      {
        url = new URL(leaf.href, location.origin);
      }
      catch (error)
      {
        continue;
      }

      url.hash = '';
      const baseHref = url.pathname;
      if (!baseHref.startsWith('/wiki/develop/api-v2/')) continue;
      if (usedHrefs.has(baseHref)) continue;
      usedHrefs.add(baseHref);

      const title = leaf.title
        || baseHref.split('/').filter(Boolean).pop().replace(/\.html$/, '')
        || '未命名';
      const folders = leaf.groups.filter(Boolean).map(sanitizeName);
      let outputPath = [ROOT_FOLDER, ...folders, `${sanitizeName(title)}.md`].join('/');

      if (usedPaths.has(outputPath))
      {
        let suffix = 2;
        while (usedPaths.has(`${outputPath.replace(/\.md$/, ` (${suffix}).md`)}`))
        {
          suffix += 1;
        }
        outputPath = outputPath.replace(/\.md$/, ` (${suffix}).md`);
      }
      usedPaths.add(outputPath);

      records.push({ title, folders, outputPath, url: url.href });
      routeMap.set(baseHref, outputPath);
    }

    return { records, routeMap };
  }

  function buildDownloadPlanFromApp(pages: AppPage[], sidebarConfig: Record<string, SidebarItem[]>): DownloadPlan
  {
    const sidebarItems = sidebarConfig['/develop/api-v2/'] || [];
    const developPages = pages.filter((page) => (
      page.relativePath && page.relativePath.startsWith('develop/api-v2/')
    ));
    const pageByRel = new Map(developPages.map((page) => [page.relativePath, page]));
    const walked = walkSidebar(sidebarItems, 'develop/api-v2/', { leaves: [], unknown: [] });
    const records: DownloadRecord[] = [];
    const routeMap = new Map<string, string>();
    const usedPaths = new Set<string>();

    for (const leaf of walked.leaves)
    {
      const rel = normalizeRel(leaf.rel, leaf.base);
      const page = pageByRel.get(rel);
      if (!page) continue;

      const title = page.title
        || leaf.titleOverride
        || rel.split('/').pop().replace(/\.md$/, '')
        || '未命名';
      const folders = leaf.folders.filter(Boolean).map(sanitizeName);
      let outputPath = [ROOT_FOLDER, ...folders, `${sanitizeName(title)}.md`].join('/');

      if (usedPaths.has(outputPath))
      {
        let suffix = 2;
        while (usedPaths.has(`${outputPath.replace(/\.md$/, ` (${suffix}).md`)}`))
        {
          suffix += 1;
        }
        outputPath = outputPath.replace(/\.md$/, ` (${suffix}).md`);
      }
      usedPaths.add(outputPath);

      const url = new URL(`/wiki${page.regularPath}`, location.origin).href;
      records.push({ title, folders, outputPath, url });
      routeMap.set(`/wiki${page.regularPath}`, outputPath);
    }

    return { records, routeMap };
  }

  function relativePath(fromFile: string, toFile: string): string
  {
    const fromParts = fromFile.split('/');
    const toParts = toFile.split('/');
    const fromDir = fromParts.slice(0, -1);
    let commonLength = 0;

    while (
      commonLength < fromDir.length &&
      commonLength < toParts.length &&
      fromDir[commonLength] === toParts[commonLength]
    )
    {
      commonLength += 1;
    }

    const ups = fromDir.slice(commonLength).map(() => '..');
    return ups.concat(toParts.slice(commonLength)).join('/');
  }

  function encodeLinkPath(path: string): string
  {
    return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  }

  function convertInternalLinks(markdown: string, currentOutputPath: string, routeMap: Map<string, string>): string
  {
    return markdown.replace(
      /\[([^\]]*)\]\((\/wiki\/[^)#?]+)((?:#[^)]*)?)\)/g,
      (all, text: string, url: string, hash: string) => {
        const cleanText = String(text || '').replace(/\s*\(opens new window\)\s*$/, '');
        const target = routeMap.get(url);

        if (!target) return `[${cleanText}](${url}${hash || ''})`;
        if (target === currentOutputPath)
        {
          if (!hash) return cleanText;
          return `[${cleanText}](${hash})`;
        }

        const linkPath = encodeLinkPath(relativePath(currentOutputPath, target));
        return `[${cleanText}](${linkPath}${hash || ''})`;
      }
    );
  }

  function escapeMarkdownText(text: string): string
  {
    return String(text || '').replace(/([\\`*_[\]])/g, '\\$1');
  }

  function normalizeInlineText(text: string): string
  {
    return String(text || '').replace(/\s+/g, ' ');
  }

  function imageMarkdown(img: HTMLImageElement): string
  {
    const alt = img.getAttribute('alt') || '';
    let src = img.currentSrc || img.src || '';

    if (!src)
    {
      const dataSrc = img.getAttribute('data-src')
        || img.getAttribute('data-original')
        || img.getAttribute('data-lazy-src')
        || img.getAttribute('data-url');

      if (dataSrc)
      {
        try
        {
          src = new URL(dataSrc, img.baseURI || location.href).href;
        }
        catch (error)
        {
          src = dataSrc;
        }
      }
    }

    if (!src) return '';
    return `![${alt}](${src})`;
  }

  function inlineMarkdown(node: Node): string
  {
    let result = '';

    for (const child of node.childNodes)
    {
      if (child.nodeType === Node.TEXT_NODE)
      {
        result += escapeMarkdownText(normalizeInlineText(child.nodeValue || ''));
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const element = child as Element;
      const tag = element.tagName;

      if (tag === 'STRONG' || tag === 'B')
      {
        result += `**${inlineMarkdown(element).trim()}**`;
      }
      else if (tag === 'EM' || tag === 'I')
      {
        result += `*${inlineMarkdown(element).trim()}*`;
      }
      else if (tag === 'CODE')
      {
        if (element.closest('pre')) continue;
        const code = element.textContent || '';
        const fence = code.includes('`') ? '``' : '`';
        result += `${fence}${code}${fence}`;
      }
      else if (tag === 'A')
      {
        if (element.classList.contains('header-anchor')) continue;
        const text = inlineMarkdown(element).trim();
        const href = element.getAttribute('href') || '';
        result += `[${text}](${href})`;
      }
      else if (tag === 'IMG')
      {
        result += imageMarkdown(element as HTMLImageElement);
      }
      else if (tag === 'BR')
      {
        result += '\n';
      }
      else if (tag === 'DEL' || tag === 'S')
      {
        result += `~~${inlineMarkdown(element).trim()}~~`;
      }
      else if (tag === 'SUP')
      {
        result += `^${inlineMarkdown(element).trim()}^`;
      }
      else if (tag === 'SUB')
      {
        result += `~${inlineMarkdown(element).trim()}~`;
      }
      else
      {
        result += inlineMarkdown(element);
      }
    }

    return result;
  }

  function listMarkdown(list: HTMLElement, indentLevel?: number): string
  {
    const level = indentLevel || 0;
    const ordered = list.tagName === 'OL';
    const lines: string[] = [];
    let itemNumber = 1;

    for (const li of Array.from(list.children))
    {
      if (li.tagName !== 'LI') continue;

      const contentParts: string[] = [];
      const nestedLists: HTMLElement[] = [];

      for (const child of li.childNodes)
      {
        if (child.nodeType === Node.TEXT_NODE)
        {
          const text = normalizeInlineText(child.nodeValue || '').trim();
          if (text) contentParts.push(text);
        }
        else if (child.nodeType === Node.ELEMENT_NODE)
        {
          const element = child as HTMLElement;
          if (element.tagName === 'UL' || element.tagName === 'OL')
          {
            nestedLists.push(element);
          }
          else if (element.tagName === 'P')
          {
            contentParts.push(inlineMarkdown(element).trim());
          }
          else
          {
            contentParts.push(inlineMarkdown(element).trim());
          }
        }
      }

      const indent = '  '.repeat(level);
      const marker = ordered ? `${itemNumber}.` : '-';
      lines.push(`${indent}${marker} ${contentParts.join(' ').trim()}`);

      for (const nestedList of nestedLists)
      {
        lines.push(listMarkdown(nestedList, level + 1));
      }

      if (ordered) itemNumber += 1;
    }

    return lines.join('\n');
  }

  function tableMarkdown(table: HTMLTableElement): string
  {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return '';

    const normalizedRows = rows.map((row) => (
      Array.from(row.children)
        .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
        .map((cell) => inlineMarkdown(cell).trim().replace(/\|/g, '\\|'))
    ));

    const columnCount = Math.max(...normalizedRows.map((row) => row.length));
    if (!columnCount) return '';

    const fillRow = (row: string[]) => {
      while (row.length < columnCount) row.push('');
      return row.slice(0, columnCount);
    };

    const header = fillRow(normalizedRows[0]);
    const bodyRows = normalizedRows.slice(1).map(fillRow);
    const lines: string[] = [];

    lines.push(`| ${header.join(' | ')} |`);
    lines.push(`| ${header.map(() => '---').join(' | ')} |`);
    for (const row of bodyRows)
    {
      lines.push(`| ${row.join(' | ')} |`);
    }

    return lines.join('\n');
  }

  function codeBlockMarkdown(pre: HTMLPreElement): string
  {
    const code = pre.querySelector('code');
    const text = (code ? code.textContent : pre.textContent || '').replace(/\n$/, '');
    let language = '';

    if (code)
    {
      const match = String(code.className || '').match(/language-([\w-]+)/);
      language = match ? match[1] : '';
    }

    return `\`\`\`${language}\n${text}\n\`\`\``;
  }

  function customBlockMarkdown(div: HTMLElement): string
  {
    const clone = div.cloneNode(true) as HTMLElement;
    const titleElement = clone.querySelector('.custom-block-title');
    const title = titleElement ? titleElement.textContent.trim() : '';
    if (titleElement) titleElement.remove();

    const body = blockMarkdown(clone).trim();
    if (!title && !body) return '';

    const lines: string[] = [];
    if (title) lines.push(`> **${title}**`);
    body.split('\n').forEach((line) => lines.push(`> ${line}`));
    return lines.join('\n');
  }

  function blockMarkdown(element: Element): string
  {
    const lines: string[] = [];

    for (const child of element.childNodes)
    {
      if (child.nodeType === Node.TEXT_NODE)
      {
        const text = (child.nodeValue || '').trim();
        if (text) lines.push(text);
        continue;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      const childElement = child as HTMLElement;
      const tag = childElement.tagName;

      if (/^H[1-6]$/.test(tag))
      {
        const text = inlineMarkdown(childElement).trim();
        if (text) lines.push(`${'#'.repeat(Number(tag[1]))} ${text}`);
      }
      else if (tag === 'P')
      {
        const text = inlineMarkdown(childElement).trim();
        if (text) lines.push(text);
      }
      else if (tag === 'BLOCKQUOTE')
      {
        const text = blockMarkdown(childElement).trim();
        if (text) lines.push(text.split('\n').map((line) => `> ${line}`).join('\n'));
      }
      else if (tag === 'UL' || tag === 'OL')
      {
        lines.push(listMarkdown(childElement, 0));
      }
      else if (tag === 'TABLE')
      {
        lines.push(tableMarkdown(childElement as HTMLTableElement));
      }
      else if (tag === 'PRE')
      {
        lines.push(codeBlockMarkdown(childElement as HTMLPreElement));
      }
      else if (tag === 'IMG')
      {
        const imageText = imageMarkdown(childElement as HTMLImageElement);
        if (imageText) lines.push(imageText);
      }
      else if (tag === 'FIGURE')
      {
        const image = childElement.querySelector('img');
        if (image)
        {
          const imageText = imageMarkdown(image);
          const caption = childElement.querySelector('figcaption');
          if (caption)
          {
            lines.push(`${imageText}\n*${inlineMarkdown(caption).trim()}*`);
          }
          else
          {
            lines.push(imageText);
          }
        }
        else
        {
          const text = blockMarkdown(childElement).trim();
          if (text) lines.push(text);
        }
      }
      else if (tag === 'DIV' && /custom-block/.test(childElement.className || ''))
      {
        lines.push(customBlockMarkdown(childElement));
      }
      else if (tag === 'HR')
      {
        lines.push('---');
      }
      else if (
        tag === 'DIV' ||
        tag === 'SECTION' ||
        tag === 'ARTICLE' ||
        tag === 'MAIN' ||
        tag === 'FIGURE'
      )
      {
        const text = blockMarkdown(childElement).trim();
        if (text) lines.push(text);
      }
      else
      {
        const text = blockMarkdown(childElement).trim();
        if (text) lines.push(text);
      }
    }

    return lines.filter(Boolean).join('\n\n');
  }

  function htmlToMarkdown(html: string, pageUrl: string): string
  {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const content = doc.querySelector('.theme-default-content')
      || doc.querySelector('main .theme-default-content')
      || doc.querySelector('.page .theme-default-content')
      || doc.querySelector('main');

    if (!content) throw new Error(`页面没有正文：${pageUrl}`);

    const clone = content.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript, .header-anchor, .sr-only').forEach((node) => node.remove());

    let markdown = blockMarkdown(clone).trim();
    if (!/^#\s/.test(markdown))
    {
      const heading = clone.querySelector('h1');
      if (heading) markdown = `# ${heading.textContent.trim()}\n\n${markdown}`;
    }

    return `${markdown.replace(/\s+$/, '')}\n`;
  }

  function makeCrcTable(): Uint32Array
  {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1)
    {
      let c = n;
      for (let k = 0; k < 8; k += 1)
      {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  }

  const CRC_TABLE = makeCrcTable();

  function crc32(bytes: Uint8Array): number
  {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes)
    {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function writeUint16(array: Uint8Array, offset: number, value: number): void
  {
    array[offset] = value & 0xFF;
    array[offset + 1] = (value >>> 8) & 0xFF;
  }

  function writeUint32(array: Uint8Array, offset: number, value: number): void
  {
    array[offset] = value & 0xFF;
    array[offset + 1] = (value >>> 8) & 0xFF;
    array[offset + 2] = (value >>> 16) & 0xFF;
    array[offset + 3] = (value >>> 24) & 0xFF;
  }

  function createZip(files: ZipFile[]): Blob
  {
    const encoder = new TextEncoder();
    const chunks: BlobPart[] = [];
    const centralRecords: CentralRecord[] = [];
    let localOffset = 0;

    for (const file of files)
    {
      const nameBytes = encoder.encode(file.path);
      const dataBytes = encoder.encode(file.content);
      const crc = crc32(dataBytes);

      const local = new Uint8Array(30);
      writeUint32(local, 0, 0x04034B50);
      writeUint16(local, 4, 20);
      writeUint16(local, 6, 0x0800);
      writeUint16(local, 8, 0);
      writeUint16(local, 10, 0);
      writeUint16(local, 12, 0);
      writeUint32(local, 14, crc);
      writeUint32(local, 18, dataBytes.length);
      writeUint32(local, 22, dataBytes.length);
      writeUint16(local, 26, nameBytes.length);
      writeUint16(local, 28, 0);

      chunks.push(local, nameBytes, dataBytes);

      centralRecords.push({
        nameBytes,
        crc,
        size: dataBytes.length,
        localOffset
      });

      localOffset += local.length + nameBytes.length + dataBytes.length;
    }

    const centralStart = localOffset;
    let centralSize = 0;

    for (const record of centralRecords)
    {
      const central = new Uint8Array(46);
      writeUint32(central, 0, 0x02014B50);
      writeUint16(central, 4, 20);
      writeUint16(central, 6, 20);
      writeUint16(central, 8, 0x0800);
      writeUint16(central, 10, 0);
      writeUint16(central, 12, 0);
      writeUint16(central, 14, 0);
      writeUint32(central, 16, record.crc);
      writeUint32(central, 20, record.size);
      writeUint32(central, 24, record.size);
      writeUint16(central, 28, record.nameBytes.length);
      writeUint16(central, 30, 0);
      writeUint16(central, 32, 0);
      writeUint16(central, 34, 0);
      writeUint16(central, 36, 0);
      writeUint32(central, 38, 0);
      writeUint32(central, 42, record.localOffset);

      chunks.push(central, record.nameBytes);
      centralSize += central.length + record.nameBytes.length;
    }

    const end = new Uint8Array(22);
    writeUint32(end, 0, 0x06054B50);
    writeUint16(end, 4, 0);
    writeUint16(end, 6, 0);
    writeUint16(end, 8, centralRecords.length);
    writeUint16(end, 10, centralRecords.length);
    writeUint32(end, 12, centralSize);
    writeUint32(end, 16, centralStart);
    writeUint16(end, 20, 0);
    chunks.push(end);

    return new Blob(chunks, { type: 'application/zip' });
  }

  async function getAppText(): Promise<string>
  {
    const appSrc = Array.from(document.scripts)
      .map((script) => script.src)
      .find((src) => /\/assets\/js\/app\.[a-f0-9]+\.js/.test(src));

    if (!appSrc)
    {
      throw new Error('未找到文档站点的 app.js，请确认当前页面是 QQ 机器人开发文档页面。');
    }

    return fetchText(new URL(appSrc, location.href).href, 60000);
  }

  async function fetchText(url: string, timeoutMs?: number): Promise<string>
  {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS);

    try
    {
      const response = await fetch(url, {
        credentials: 'same-origin',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.text();
    }
    finally
    {
      clearTimeout(timer);
    }
  }

  async function mapWithConcurrency<T>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<void>,
    onProgress: (done: number, total: number, failCount: number) => void,
    failures: DownloadFailure[]
  ): Promise<void>
  {
    let nextIndex = 0;
    let completed = 0;

    async function run(): Promise<void>
    {
      while (true)
      {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;

        try
        {
          await worker(items[index], index);
        }
        catch (error)
        {
          failures.push({
            title: items[index].title,
            url: items[index].url,
            error: error && (error as Error).message ? (error as Error).message : String(error)
          });
        }

        completed += 1;
        onProgress(completed, items.length, failures.length);
      }
    }

    const workerCount = Math.min(limit, items.length);
    await Promise.all(Array.from({ length: workerCount }, () => run()));
  }

  function saveBlob(blob: Blob, filename: string): void
  {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  }

  async function handleDownload(): Promise<void>
  {
    if (running) return;
    if (!button || !statusBox) return;

    running = true;
    button.disabled = true;
    button.textContent = '下载中...';
    setStatus('正在读取文档索引...');

    try
    {
      let plan: DownloadPlan | null = null;

      try
      {
        const appText = await getAppText();
        plan = buildDownloadPlanFromApp(parsePages(appText), parseSidebarConfig(appText));
      }
      catch (appError)
      {
        plan = null;
      }

      if (!plan || !plan.records.length)
      {
        setStatus('正在展开并读取左侧文档目录...');
        await expandSidebar();
        plan = buildDownloadPlanFromDom();
      }

      if (!plan.records.length)
      {
        throw new Error('没有从左侧目录中解析到开发文档。');
      }

      const failures: DownloadFailure[] = [];
      const files: ZipFile[] = [];
      let completed = 0;

      setStatus(`已找到 ${plan.records.length} 篇文档，开始下载...`);

      await mapWithConcurrency<DownloadRecord>(
        plan.records,
        CONCURRENCY,
        async (record) => {
          const html = await fetchText(record.url, FETCH_TIMEOUT_MS);
          let markdown = htmlToMarkdown(html, record.url);
          markdown = convertInternalLinks(markdown, record.outputPath, plan!.routeMap);
          files.push({ path: record.outputPath, content: markdown });
        },
        (done, total, failCount) => {
          completed = done;
          setStatus(
            `下载中：${done}/${total}${failCount ? `，失败 ${failCount}` : ''}...`,
            failCount > 0
          );
        },
        failures
      );

      if (!files.length) throw new Error('所有文档均下载失败。');

      setStatus('正在生成压缩包...');
      const blob = createZip(files);
      const now = new Date();
      const pad = (value: number) => String(value).padStart(2, '0');
      const timestamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        '_',
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
      ].join('');
      saveBlob(blob, `${ROOT_FOLDER}_${timestamp}.zip`);

      setStatus(
        failures.length
          ? `完成：成功 ${completed - failures.length} 篇，失败 ${failures.length} 篇。`
          : `完成：已下载 ${completed} 篇文档。`
      );
    }
    catch (error)
    {
      setStatus(`下载失败：${error && (error as Error).message ? (error as Error).message : error}`, true);
    }
    finally
    {
      running = false;
      if (button)
      {
        button.disabled = false;
        button.textContent = '下载文档';
      }
    }
  }

  if (document.readyState === 'loading')
  {
    document.addEventListener('DOMContentLoaded', ensureUi, { once: true });
  }
  else
  {
    ensureUi();
  }
})();
