// Bilibili专栏原图链接提取2024改版
// PC端B站专栏图片默认是经压缩过的webp。此脚本帮助用户点击按钮后获取哔哩哔哩专栏中所有原图的直链，方便使用其他工具批量下载原图。

(function() {
  'use strict'
  const iconExtractLink = 'https://i0.hdslb.com/bfs/article/7a0cc21280e2ba013d2681cff4dee947312276085.png'
  const iconCopyLink = 'https://i0.hdslb.com/bfs/article/cecac694c99629afbe764eb2b2066a46312276085.png'
  const iconDownloadEach = 'https://i0.hdslb.com/bfs/article/0896498c861585719a122e0fc6ef5689312276085.png'
  const iconDownloadMarkdown = 'https://www.svgrepo.com/show/510065/markdown.svg'

  function createButton(targetContainer: HTMLElement, showDownloadEach: boolean, isHorizontal: boolean, showMarkdownButton: boolean) {
    const buttonsContainer = document.createElement('div')
    buttonsContainer.style.display = 'flex'
    buttonsContainer.style.flexDirection = isHorizontal ? 'row' : 'column'
    buttonsContainer.style.alignItems = 'center'

    const existingItem = targetContainer.querySelector('.toolbar-item, .side-toolbar__action, .bili-dyn-item__action')
    const height = existingItem ? existingItem.clientHeight : 40
    const width = existingItem ? existingItem.clientWidth : 40

    const buttonDownload = document.createElement('button')
    buttonDownload.id = 'btn001'
    buttonDownload.className = 'toolbar-item'
    buttonDownload.style.cssText = setButtonStyle('#C7EDCC', width, height, iconExtractLink)
    buttonDownload.onclick = function() {
      handleButtonClick(buttonDownload, true)
    }
    buttonsContainer.appendChild(buttonDownload)

    const buttonCopy = document.createElement('button')
    buttonCopy.id = 'btn002'
    buttonCopy.className = 'toolbar-item'
    buttonCopy.style.cssText = setButtonStyle('#E3EDCD', width, height, iconCopyLink)
    buttonCopy.onclick = function() {
      handleButtonClick(buttonCopy, false)
    }
    buttonsContainer.appendChild(buttonCopy)

    if (showDownloadEach) {
      const buttonDownloadEach = document.createElement('button')
      buttonDownloadEach.id = 'btn003'
      buttonDownloadEach.className = 'toolbar-item'
      buttonDownloadEach.style.cssText = setButtonStyle('#FFD700', width, height, iconDownloadEach)
      buttonDownloadEach.onclick = function() {
        handleButtonClick(buttonDownloadEach, 'each')
      }
      buttonsContainer.appendChild(buttonDownloadEach)
    }

    if (showMarkdownButton) {
      const buttonDownloadMD = document.createElement('button')
      buttonDownloadMD.id = 'btn004'
      buttonDownloadMD.className = 'toolbar-item'
      buttonDownloadMD.style.cssText = setButtonStyle('#ADD8E6', width, height, iconDownloadMarkdown)
      buttonDownloadMD.onclick = function() {
        handleMarkdownDownload(buttonDownloadMD)
      }
      buttonsContainer.appendChild(buttonDownloadMD)
    }

    targetContainer.appendChild(buttonsContainer)
  }

  function setButtonStyle(backgroundColor: string, width: number, height: number, icon: string) {
    return `
            border-radius: 6px;
            margin: 5px 0;
            height: ${height}px;
            width: ${width}px;
            padding: 0px;
            background-color: ${backgroundColor};
            color: black;
            font-weight: bold;
            overflow: hidden;
            text-align: center;
            box-shadow: inset 0 0 20px rgba(255, 255, 255, 1);
            background-image: url(${icon});
            background-size: 30px 30px;
            background-repeat: no-repeat;
            background-position: center;
        `
  }

  function urlGetAllModes(button: HTMLButtonElement, mode: boolean | string) {
    const modes = [1, 2, 3, 4, 5]
    let urlList: string[] = []
    let modeFound = false

    for (const m of modes) {
      const { selector, attribute } = getSelectorAndAttributeByMode(m)
      const imgList = document.querySelectorAll(selector)
      if (imgList.length > 0) {
        modeFound = true
        imgList.forEach(item => {
          let text = item.getAttribute(attribute)
          if (!text) {
            const imgElement = item.querySelector('img')
            if (imgElement) {
              text = imgElement.getAttribute('src')
            }
          }
          if (text && (text.includes('.jpg') || text.includes('.png') || text.includes('.webp') || text.includes('.jpeg') || text.includes('.gif') || text.includes('.bmp'))) {
            if (text.startsWith('//')) {
              text = 'https:' + text
            }
            text = text.split('@')[0]
            if (!text.includes('/face') && !text.includes('/garb')) {
              urlList.push(text)
            }
          }
        })
      }
    }

    urlList = Array.from(new Set(urlList))
    const selectedUrls = getSelectedUrls()

    if (!modeFound) {
      alert('在正文中似乎并没有获取到图片……')
      button.textContent = '无图片：点击无效，请刷新重试'
    } else {
      const urlStr = (mode === 'each' ? urlList : selectedUrls).join('\n')
      const urlCount = (mode === 'each' ? urlList : selectedUrls).length

      if (mode === true) {
        downloadTxt('bili_img_urls', urlStr)
        button.innerHTML = `已提取${urlCount}张`
      } else if (mode === false) {
        copyToClipboard(urlStr)
        button.innerHTML = `已复制${urlCount}张`
      } else if (mode === 'each') {
        downloadEachImage(selectedUrls)
        button.innerHTML = '正在下载'
      }
    }
  }

  function getSelectorAndAttributeByMode(mode: number) {
    switch (mode) {
      case 1:
        return { selector: '#article-content img[data-src].normal-img', attribute: 'data-src' }
      case 2:
        return { selector: '#article-content p.normal-img img', attribute: 'src' }
      case 3:
        return { selector: 'div.opus-module-content img', attribute: 'src' }
      case 4:
        return { selector: '.dyn-card-opus__pics img', attribute: 'src' }
      case 5:
        return { selector: 'div.opus-para-pic', attribute: '' }
      default:
        alert('传入模式参数错误！')
        return { selector: '', attribute: '' }
    }
  }

  function downloadTxt(filename: string, text: string) {
    const currentUrl = window.location.href
    let customFilename = filename

    if (currentUrl.includes('/opus/')) {
      const opusId = currentUrl.match(/\/opus\/(\d+)/)
      if (opusId && opusId[1]) {
        customFilename = `bili_img_urls.opus.${opusId[1]}.txt`
      }
    } else if (currentUrl.includes('/read/cv')) {
      const cvId = currentUrl.match(/\/read\/cv(\d+)/)
      if (cvId && cvId[1]) {
        customFilename = `bili_img_urls.read.cv${cvId[1]}.txt`
      }
    } else if (currentUrl.includes('t.bilibili.com/')) {
      const tId = currentUrl.match(/t\.bilibili\.com\/(\d+)/)
      if (tId && tId[1]) {
        customFilename = `bili_img_urls.t.${tId[1]}.txt`
      }
    } else {
      customFilename = `${filename}.txt`
    }

    const pom = document.createElement('a')
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
    pom.setAttribute('download', customFilename)
    pom.click()
  }

  function downloadEachImage(urls: string[]) {
    urls.forEach((url, index) => {
      setTimeout(() => {
        const link = document.createElement('a')
        fetch(url)
          .then(response => response.blob())
          .then(blob => {
            const blobUrl = URL.createObjectURL(blob)
            link.href = blobUrl
            link.download = url.split('/').pop() || 'image'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(blobUrl)
          })
          .catch(e => console.error('Download failed:', e))
      }, index * 100)
    })
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Text copied to clipboard')
    }).catch(err => {
      console.error('Failed to copy text: ', err)
    })
  }

  function handleDynamicItem(item: Element) {
    const footer = item.querySelector('.bili-dyn-item__footer')
    const action = footer ? footer.querySelector('.bili-dyn-item__action') : null
    if (footer && action && !footer.querySelector('button')) {
      createButton(footer as HTMLElement, false, true, false)

      const buttonDownload = footer.querySelector('#btn001') as HTMLButtonElement
      const buttonCopy = footer.querySelector('#btn002') as HTMLButtonElement

      buttonDownload.onclick = () => {
        buttonDownload.disabled = true
        buttonDownload.style.backgroundColor = '#FDE6E0'
        buttonDownload.style.backgroundImage = 'none'
        extractDynamicImages(item, true, buttonDownload)
      }

      buttonCopy.onclick = () => {
        buttonCopy.disabled = true
        buttonCopy.style.backgroundColor = '#FDE6E0'
        buttonCopy.style.backgroundImage = 'none'
        extractDynamicImages(item, false, buttonCopy)
      }
    }
  }

  function extractDynamicImages(item: Element, download: boolean, button: HTMLButtonElement) {
    const imgList = item.querySelectorAll('.bili-album__preview__picture__img img, img')
    const urlSet = new Set<string>()

    imgList.forEach(img => {
      let src = img.getAttribute('src')
      if (src) {
        if (src.startsWith('//')) {
          src = 'https:' + src
        }
        const baseUrl = src.split('@')[0]
        if (!baseUrl.includes('/face') && !baseUrl.includes('/garb')) {
          urlSet.add(baseUrl)
        }
      }
    })

    const urlStr = Array.from(urlSet).join('\n')
    if (download) {
      downloadTxt('bili_dyn_img_urls', urlStr)
      button.innerHTML = '已整理'
    } else {
      copyToClipboard(urlStr)
      button.innerHTML = '已复制'
    }
  }

  function observeDocument() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && (node as Element).matches('.bili-dyn-list__item')) {
            handleDynamicItem(node as Element)
          }
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  function addSelectionFeatures() {
    const imageElements = document.querySelectorAll('#article-content img[data-src].normal-img, #article-content p.normal-img img, div.opus-para-pic')

    imageElements.forEach(imgElement => {
      const overlay = document.createElement('div')
      overlay.classList.add('image-overlay')
      overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9;
            cursor: pointer;
        `

      const checkbox = document.createElement('div')
      checkbox.classList.add('image-checkbox')
      checkbox.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="green" stroke="green" stroke-width="2"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
      checkbox.style.cssText = `
            position: absolute;
            right: 5px;
            bottom: 5px;
            width: 30px;
            height: 30px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10;
        `;

      (imgElement as HTMLElement).dataset.selected = 'true'

      let parentElement = imgElement.parentNode as HTMLElement
      if (imgElement.classList.contains('opus-para-pic')) {
        parentElement = imgElement as HTMLElement
      }
      parentElement.style.position = 'relative'
      parentElement.appendChild(overlay)
      parentElement.appendChild(checkbox)

      overlay.addEventListener('click', function(event) {
        event.preventDefault()
        event.stopPropagation()

        const isSelected = (imgElement as HTMLElement).dataset.selected === 'true';
        (imgElement as HTMLElement).dataset.selected = isSelected ? 'false' : 'true'

        if (isSelected) {
          checkbox.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="red" stroke="red" stroke-width="2"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>'
        } else {
          checkbox.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" fill="green" stroke="green" stroke-width="2"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
        }
      })

      checkbox.style.display = 'flex'
    })
  }

  function getSelectedUrls(): string[] {
    const selectedUrls: string[] = []
    const imageElements = document.querySelectorAll('#article-content img[data-src].normal-img, #article-content p.normal-img img, div.opus-para-pic')

    imageElements.forEach(imgElement => {
      if ((imgElement as HTMLElement).dataset.selected === 'true') {
        let src: string | null = null
        if (imgElement.classList.contains('opus-para-pic')) {
          const img = imgElement.querySelector('img')
          if (img) {
            src = img.getAttribute('src')
          }
        } else {
          src = imgElement.getAttribute('src') || (imgElement as HTMLElement).dataset.src || null
        }

        if (src) {
          if (src.startsWith('//')) {
            src = 'https:' + src
          }
          src = src.split('@')[0]

          if (!src.includes('/face') && !src.includes('/garb')) {
            selectedUrls.push(src)
          }
        }
      }
    })

    return selectedUrls
  }

  function handleButtonClick(button: HTMLButtonElement, mode: boolean | string) {
    const selectedUrls = getSelectedUrls()
    if (selectedUrls.length === 0) {
      button.disabled = true
      button.style.backgroundColor = '#FDE6E0'
      button.style.backgroundImage = 'none'
      button.innerHTML = '未选图~'

      setTimeout(() => {
        button.disabled = false
        button.style.backgroundColor = ''
        button.style.backgroundImage = `url(${mode === true ? iconExtractLink : (mode === false ? iconCopyLink : iconDownloadEach)})`
        button.style.cssText = setButtonStyle(
          mode === true ? '#C7EDCC' : mode === false ? '#E3EDCD' : '#FFD700',
          button.clientWidth,
          button.clientHeight,
          mode === true ? iconExtractLink : mode === false ? iconCopyLink : iconDownloadEach,
        )
        button.innerHTML = ''
      }, 3000)
    } else {
      button.disabled = true
      button.style.backgroundColor = '#FDE6E0'
      button.style.backgroundImage = 'none'
      button.innerHTML = '正在处理，请稍候...'
      urlGetAllModes(button, mode)
    }
  }

  function downloadMd(filename: string, text: string) {
    const currentUrl = window.location.href
    let customFilename = filename
    let articleTitle = (document.querySelector('.opus-module-title__text') as HTMLElement)?.innerText ||
                          (document.querySelector('.title') as HTMLElement)?.innerText || ''

    articleTitle = articleTitle.replace(/[\\/:"*?<>|]/g, '_')

    if (currentUrl.includes('/opus/')) {
      const opusId = currentUrl.match(/\/opus\/(\d+)/)
      if (opusId && opusId[1]) {
        customFilename = `${articleTitle || `bili_article.opus.${opusId[1]}`}.md`
      }
    } else if (currentUrl.includes('/read/cv')) {
      const cvId = currentUrl.match(/\/read\/cv(\d+)/)
      if (cvId && cvId[1]) {
        customFilename = `${articleTitle || `bili_article.read.cv${cvId[1]}`}.md`
      }
    } else {
      customFilename = `${articleTitle || filename}.md`
    }

    const pom = document.createElement('a')
    pom.setAttribute('href', 'data:text/markdown;charset=utf-8,' + encodeURIComponent(text))
    pom.setAttribute('download', customFilename)
    pom.click()
  }

  function convertArticleToMarkdown(): string {
    const title = (document.querySelector('.opus-module-title__text') as HTMLElement)?.innerText ||
                     (document.querySelector('.title') as HTMLElement)?.innerText || 'Untitled'
    let markdown = `# ${title}\n\n`

    const authorEl = document.querySelector('.opus-module-author__name')
    const pubDateEl = document.querySelector('.opus-module-author__pub__text')
    if (authorEl) {
      markdown += `> 作者：${authorEl.textContent}\n`
    }
    if (pubDateEl) {
      markdown += `> ${pubDateEl.textContent}\n`
    }
    if (authorEl || pubDateEl) {
      markdown += '\n'
    }

    const articleContainer = document.querySelector('.opus-module-content.opus-paragraph-children') ||
                                document.querySelector('#article-content')
    if (!articleContainer) return markdown

    const processInlines = (element: Element): string => {
      let content = ''
      for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          content += child.textContent
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as Element
          const tagName = childEl.tagName.toLowerCase()
          const innerContent = processInlines(childEl)

          if (innerContent.trim() === '' && !['br', 'img'].includes(tagName)) {
            continue
          }

          switch (tagName) {
            case 'strong':
            case 's':
            case 'em':
            case 'i': {
              const marker = { strong: '**', s: '~~', em: '*', i: '*' }[tagName] || ''
              const leadSpace = innerContent.match(/^\s*/)?.[0] || ''
              const trailSpace = innerContent.match(/\s*$/)?.[0] || ''
              const trimmed = innerContent.trim()

              if (trimmed) {
                const finalLeadSpace = leadSpace.length > 0 ? leadSpace : ' '
                const finalTrailSpace = trailSpace.length > 0 ? trailSpace : ' '
                content += `${finalLeadSpace}${marker}${trimmed}${marker}${finalTrailSpace}`
              } else {
                content += innerContent
              }
              break
            }
            case 'a':
              if (childEl.querySelector('img')) {
                content += innerContent
              } else {
                content += `[${innerContent}](${(childEl as HTMLAnchorElement).href})`
              }
              break
            case 'br':
              content += '  \n'
              break
            case 'img': {
              let src = ((childEl as HTMLImageElement).src || (childEl as HTMLElement).dataset.src || '').split('@')[0]
              if (src.startsWith('//')) {
                src = 'https:' + src
              }
              if (src) {
                content += `<center><img src="${src}" alt="${(childEl as HTMLImageElement).alt || 'image'}" referrerpolicy="no-referrer"></center>`
              }
              break
            }
            case 'p':
            case 'span':
            case 'div':
            default:
              content += innerContent
              break
          }
        }
      }
      return content
    }

    for (const node of articleContainer.children) {
      const tagName = node.tagName.toLowerCase()
      const nodeContent = processInlines(node).replace(/\*\*\s*\*\*/g, '')

      switch (tagName) {
        case 'h1':
          markdown += `## ${nodeContent}\n\n`
          break
        case 'h2':
          markdown += `### ${nodeContent}\n\n`
          break
        case 'h3':
          markdown += `#### ${nodeContent}\n\n`
          break
        case 'h4':
          markdown += `##### ${nodeContent}\n\n`
          break
        case 'h5':
        case 'h6':
          markdown += `###### ${nodeContent}\n\n`
          break
        case 'p':
          if (nodeContent.trim() === '') {
            if (!markdown.endsWith('\n\n') && !markdown.endsWith('\n')) {
              markdown += '\n'
            }
          } else {
            if ((node as HTMLElement).style.textAlign === 'center') {
              markdown += `<center>${nodeContent}</center>\n\n`
            } else {
              markdown += `${nodeContent}\n\n`
            }
          }
          break
        case 'figure':
          if (node.classList.contains('opus-para-line')) {
            markdown += '---\n\n'
          } else {
            if (nodeContent.trim()) {
              markdown += `${nodeContent}\n\n`
            }
          }
          break
        case 'div':
          if (nodeContent.trim()) {
            markdown += `${nodeContent}\n\n`
          }
          break
        case 'ul': {
          let listContent = ''
          for (const li of node.querySelectorAll('li')) {
            listContent += `- ${processInlines(li).replace(/\*\*\s*\*\*/g, '')}\n`
          }
          markdown += `${listContent}\n`
          break
        }
        default:
          if (nodeContent.trim()) {
            markdown += `${nodeContent}\n\n`
          }
          break
      }
    }
    return markdown.replace(/(\n{3,})/g, '\n\n').trim()
  }

  function handleMarkdownDownload(button: HTMLButtonElement) {
    button.disabled = true
    button.style.backgroundColor = '#FDE6E0'
    button.style.backgroundImage = 'none'
    button.innerHTML = '正在生成...'

    try {
      const markdownContent = convertArticleToMarkdown()
      if (markdownContent && markdownContent.trim() !== '') {
        downloadMd('bili_article', markdownContent)
        button.innerHTML = '已下载'
      } else {
        button.innerHTML = '内容为空，请【前往新版】'
      }
    } catch (e) {
      console.error('Markdown conversion failed:', e)
      button.innerHTML = '生成失败'
    }

    setTimeout(() => {
      button.disabled = false
      button.style.cssText = setButtonStyle(
        '#ADD8E6',
        button.clientWidth,
        button.clientHeight,
        iconDownloadMarkdown,
      )
      button.innerHTML = ''
    }, 3000)
  }

  if (window.location.href.includes('space.bilibili.com') && window.location.href.includes('dynamic')) {
    observeDocument()
  } else if (window.location.href.includes('read/cv')) {
    const observer = new MutationObserver(function(mutations, me) {
      const toolbar = document.querySelector('.side-toolbar')
      if (toolbar) {
        createButton(toolbar as HTMLElement, false, false, true)
        addSelectionFeatures()
        me.disconnect()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  } else if (window.location.href.includes('opus/')) {
    const observerOpus = new MutationObserver(function(mutations, me) {
      const toolbarOpus = document.querySelector('.side-toolbar__box')
      if (toolbarOpus) {
        const showDownloadEach = window.location.href.includes('opus/')
        createButton(toolbarOpus as HTMLElement, showDownloadEach, false, true)
        addSelectionFeatures()
        me.disconnect()
      }
    })
    observerOpus.observe(document.body, { childList: true, subtree: true })
  } else if (window.location.href.includes('t.bilibili.com')) {
    const observerT = new MutationObserver(function(mutations, me) {
      const toolbarT = document.querySelector('.side-toolbar__box')
      if (toolbarT) {
        createButton(toolbarT as HTMLElement, true, false, false)
        me.disconnect()
      }
    })
    observerT.observe(document.body, { childList: true, subtree: true })
  }
})()
