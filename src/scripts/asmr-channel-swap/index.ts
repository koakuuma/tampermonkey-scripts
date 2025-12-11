// ASMR音频声道反转脚本
// 在ASMR网站上添加音频声道反转功能，支持多种声道模式切换

(function ()
{
  'use strict';

  // 声道模式枚举
  const ChannelMode = {
    NORMAL: 'normal',      // 正常声道
    SWAP: 'swap',          // 反转声道
    LEFT_ONLY: 'left',     // 仅左声道
    RIGHT_ONLY: 'right'    // 仅右声道
  };

  // 当前声道模式
  let currentMode: string = ChannelMode.NORMAL;
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaElementAudioSourceNode | null = null;
  let splitter: ChannelSplitterNode | null = null;
  let merger: ChannelMergerNode | null = null;
  let currentAudioElement: HTMLAudioElement | null = null;

  // 声道模式配置
  const modeConfig = [
    { value: ChannelMode.NORMAL, label: '正常声道', icon: '🔊', color: '#00bfa5' },
    { value: ChannelMode.SWAP, label: '反转声道', icon: '🔄', color: '#ff5252' },
    { value: ChannelMode.LEFT_ONLY, label: '仅左声道', icon: '◀️', color: '#2196f3' },
    { value: ChannelMode.RIGHT_ONLY, label: '仅右声道', icon: '▶️', color: '#ff9800' }
  ];

  // 获取当前模式索引
  function getCurrentModeIndex(): number
  {
    return modeConfig.findIndex(m => m.value === currentMode);
  }

  // 获取当前模式配置
  function getCurrentModeConfig()
  {
    return modeConfig[getCurrentModeIndex()];
  }

  // 创建声道切换器（轮切模式）
  function createChannelSelector(): HTMLElement
  {
    const container = document.createElement('div');
    container.id = 'channel-selector-container';
    container.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 20px;
      user-select: none;
    `;
    container.setAttribute('data-v-627ee493', '');

    // 创建左箭头按钮
    const leftButton = document.createElement('button');
    leftButton.id = 'channel-prev-btn';
    leftButton.tabIndex = 0;
    leftButton.type = 'button';
    leftButton.className = 'q-btn q-btn-item non-selectable no-outline q-btn--flat q-btn--round q-btn--actionable q-focusable q-hoverable';
    leftButton.style.cssText = `
      min-width: 32px;
      min-height: 32px;
      padding: 0;
      font-size: 18px;
    `;
    leftButton.setAttribute('data-v-627ee493', '');
    leftButton.innerHTML = `
      <span class="q-focus-helper"></span>
      <span class="q-btn__wrapper col row q-anchor--skip">
        <span class="q-btn__content text-center col items-center q-anchor--skip justify-center row">
          <i aria-hidden="true" role="img" class="q-icon notranslate material-icons">chevron_left</i>
        </span>
      </span>
    `;

    // 创建模式显示标签
    const modeLabel = document.createElement('div');
    modeLabel.id = 'channel-mode-label';
    modeLabel.style.cssText = `
      min-width: 100px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      color: ${getCurrentModeConfig().color};
      white-space: nowrap;
      transition: color 0.3s;
    `;
    modeLabel.textContent = `${getCurrentModeConfig().icon} ${getCurrentModeConfig().label}`;

    // 创建右箭头按钮
    const rightButton = document.createElement('button');
    rightButton.id = 'channel-next-btn';
    rightButton.tabIndex = 0;
    rightButton.type = 'button';
    rightButton.className = 'q-btn q-btn-item non-selectable no-outline q-btn--flat q-btn--round q-btn--actionable q-focusable q-hoverable';
    rightButton.style.cssText = `
      min-width: 32px;
      min-height: 32px;
      padding: 0;
      font-size: 18px;
    `;
    rightButton.setAttribute('data-v-627ee493', '');
    rightButton.innerHTML = `
      <span class="q-focus-helper"></span>
      <span class="q-btn__wrapper col row q-anchor--skip">
        <span class="q-btn__content text-center col items-center q-anchor--skip justify-center row">
          <i aria-hidden="true" role="img" class="q-icon notranslate material-icons">chevron_right</i>
        </span>
      </span>
    `;

    // 左箭头点击事件 - 切换到上一个模式
    leftButton.addEventListener('click', (e) =>
    {
      e.stopPropagation();
      const currentIndex = getCurrentModeIndex();
      const prevIndex = (currentIndex - 1 + modeConfig.length) % modeConfig.length;
      const prevMode = modeConfig[prevIndex];
      switchChannelMode(prevMode.value);
      updateModeLabel(prevMode);
    });

    // 右箭头点击事件 - 切换到下一个模式
    rightButton.addEventListener('click', (e) =>
    {
      e.stopPropagation();
      const currentIndex = getCurrentModeIndex();
      const nextIndex = (currentIndex + 1) % modeConfig.length;
      const nextMode = modeConfig[nextIndex];
      switchChannelMode(nextMode.value);
      updateModeLabel(nextMode);
    });

    // 点击标签也可以切换到下一个模式
    modeLabel.addEventListener('click', (e) =>
    {
      e.stopPropagation();
      const currentIndex = getCurrentModeIndex();
      const nextIndex = (currentIndex + 1) % modeConfig.length;
      const nextMode = modeConfig[nextIndex];
      switchChannelMode(nextMode.value);
      updateModeLabel(nextMode);
    });
    modeLabel.style.cursor = 'pointer';

    container.appendChild(leftButton);
    container.appendChild(modeLabel);
    container.appendChild(rightButton);

    return container;
  }

  // 更新模式标签
  function updateModeLabel(modeInfo: typeof modeConfig[0])
  {
    const label = document.getElementById('channel-mode-label');
    if (label)
    {
      label.textContent = `${modeInfo.icon} ${modeInfo.label}`;
      label.style.color = modeInfo.color;
    }
  }

  // 初始化音频处理
  function initAudioProcessing(audioElement: HTMLAudioElement)
  {
    try
    {
      // 如果已经初始化过，先清理
      if (audioContext && sourceNode)
      {
        cleanupAudioProcessing();
      }

      // 创建音频上下文
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // 创建源节点
      sourceNode = audioContext.createMediaElementSource(audioElement);

      // 创建声道分离器（将立体声分离为左右声道）
      splitter = audioContext.createChannelSplitter(2);

      // 创建声道合并器（将左右声道合并回立体声）
      merger = audioContext.createChannelMerger(2);

      // 连接节点：音频源 -> 分离器
      sourceNode.connect(splitter);

      // 应用当前模式
      applyChannelMode(currentMode);

      // 连接到输出
      merger.connect(audioContext.destination);

      currentAudioElement = audioElement;

      console.log('音频处理初始化成功');
    } catch (error)
    {
      console.error('音频处理初始化失败:', error);
    }
  }

  // 应用声道模式
  function applyChannelMode(mode: string)
  {
    if (!splitter || !merger) return;

    // 断开所有连接
    splitter.disconnect();

    switch (mode)
    {
      case ChannelMode.NORMAL:
        // 正常模式：左->左，右->右
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 1, 1);
        console.log('已切换到：正常声道');
        break;

      case ChannelMode.SWAP:
        // 反转模式：左->右，右->左
        splitter.connect(merger, 0, 1);
        splitter.connect(merger, 1, 0);
        console.log('已切换到：反转声道');
        break;

      case ChannelMode.LEFT_ONLY:
        // 仅左声道：左->左和右
        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 0, 1);
        console.log('已切换到：仅左声道');
        break;

      case ChannelMode.RIGHT_ONLY:
        // 仅右声道：右->左和右
        splitter.connect(merger, 1, 0);
        splitter.connect(merger, 1, 1);
        console.log('已切换到：仅右声道');
        break;
    }
  }

  // 切换声道模式
  function switchChannelMode(mode: string)
  {
    if (!audioContext || !splitter || !merger || !currentAudioElement)
    {
      console.error('音频处理未初始化');
      return;
    }

    try
    {
      currentMode = mode;
      applyChannelMode(mode);
    } catch (error)
    {
      console.error('切换声道模式失败:', error);
    }
  }

  // 清理音频处理
  function cleanupAudioProcessing()
  {
    if (sourceNode)
    {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (splitter)
    {
      splitter.disconnect();
      splitter = null;
    }
    if (merger)
    {
      merger.disconnect();
      merger = null;
    }
    if (audioContext)
    {
      audioContext.close();
      audioContext = null;
    }
    currentAudioElement = null;
    currentMode = ChannelMode.NORMAL;
  }

  // 监听音频元素并插入选择器到播放器
  function observeAudioElements()
  {
    const selector = createChannelSelector();
    let selectorInserted = false;

    // 尝试将选择器插入到播放器控制栏
    const insertSelectorToPlayer = () =>
    {
      if (selectorInserted) return;

      // 查找播放控制按钮组（支持PC端和移动端多种布局）
      const controlRow =
        // PC端选择器
        document.querySelector('.row.flex-center') ||
        document.querySelector('.row.q-py-md.self-center') ||
        // 移动端选择器
        document.querySelector('.row.items-center.q-mx-lg.q-pt-sm') ||
        document.querySelector('.row.items-center.q-gutter-x-sm') ||
        document.querySelector('[data-v-627ee493].row.items-center') ||
        // 通用选择器 - 查找包含音量控制的行
        Array.from(document.querySelectorAll('.row.items-center')).find(el =>
          el.querySelector('.material-icons')?.textContent?.includes('volume')
        );

      if (controlRow && (controlRow.querySelector('button') || controlRow.querySelector('.ant-slider')))
      {
        // 插入到播放控制按钮组的最后
        controlRow.appendChild(selector);
        selectorInserted = true;
        console.log('声道选择器已插入到播放器');
      }
    };

    // 检查音频元素的函数
    const checkAudioElements = () =>
    {
      const audioElements = document.querySelectorAll('audio');

      if (audioElements.length > 0)
      {
        // 尝试插入选择器
        insertSelectorToPlayer();

        audioElements.forEach((audio) =>
        {
          // 监听播放事件
          if (!audio.dataset.channelSwapListenerAdded)
          {
            audio.addEventListener('play', () =>
            {
              console.log('检测到音频播放');

              // 初始化音频处理
              if (!sourceNode || currentAudioElement !== audio)
              {
                initAudioProcessing(audio);
              }
            });

            audio.addEventListener('pause', () =>
            {
              console.log('音频暂停');
            });

            audio.addEventListener('ended', () =>
            {
              console.log('音频播放结束');
            });

            audio.dataset.channelSwapListenerAdded = 'true';
          }
        });
      }
    };

    // 立即检查一次
    checkAudioElements();

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver((mutations) =>
    {
      checkAudioElements();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 定期检查（作为备用方案）
    setInterval(checkAudioElements, 2000);
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading')
  {
    document.addEventListener('DOMContentLoaded', observeAudioElements);
  } else
  {
    observeAudioElements();
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', () =>
  {
    cleanupAudioProcessing();
  });

  console.log('ASMR声道切换脚本已加载');
})();