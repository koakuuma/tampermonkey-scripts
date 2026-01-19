// ASMR音频声道控制脚本
// 在ASMR网站上添加音频声道控制功能，支持声道平衡、独立音量控制和反转

(function ()
{
  'use strict';

  // 音频处理相关变量
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaElementAudioSourceNode | null = null;
  let splitter: ChannelSplitterNode | null = null;
  let merger: ChannelMergerNode | null = null;
  let gainNodeLeft: GainNode | null = null;
  let gainNodeRight: GainNode | null = null;
  let currentAudioElement: HTMLAudioElement | null = null;

  // 声道控制参数
  let leftVolume = 1.0;    // 左声道音量 (0-1)
  let rightVolume = 1.0;   // 右声道音量 (0-1)
  let balance = 0;         // 平衡值 (-1到1, -1为全左, 0为居中, 1为全右)
  let isSwapped = false;   // 是否反转声道

  // UI状态
  let isPanelVisible = false;
  let panelElement: HTMLElement | null = null;

  // 创建触发按钮
  function createTriggerButton(): HTMLElement
  {
    const button = document.createElement('button');
    button.id = 'channel-control-trigger';
    button.tabIndex = 0;
    button.type = 'button';
    button.className = 'q-btn q-btn-item non-selectable no-outline q-btn--flat q-btn--round q-btn--actionable q-focusable q-hoverable';
    button.style.cssText = `
      min-width: 32px;
      min-height: 32px;
      padding: 0;
      font-size: 18px;
    `;
    button.setAttribute('data-v-627ee493', '');
    button.innerHTML = `
      <span class="q-focus-helper"></span>
      <span class="q-btn__wrapper col row q-anchor--skip">
        <span class="q-btn__content text-center col items-center q-anchor--skip justify-center row">
          <i aria-hidden="true" role="img" class="q-icon notranslate material-icons">graphic_eq</i>
        </span>
      </span>
    `;

    // 点击按钮切换面板显示/隐藏
    button.addEventListener('click', (e) =>
    {
      e.stopPropagation();
      togglePanel();
    });

    return button;
  }

  // 创建声道控制面板
  function createChannelControlPanel(): HTMLElement
  {
    const wrapper = document.createElement('div');
    wrapper.id = 'channel-control-panel-wrapper';
    wrapper.style.cssText = `
      position: fixed;
      bottom: 120px;
      right: 20px;
      z-index: 9999;
      display: none;
    `;

    const container = document.createElement('div');
    container.id = 'channel-control-panel';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.98);
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      user-select: none;
      min-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      backdrop-filter: blur(10px);
    `;
    container.setAttribute('data-v-627ee493', '');

    // 标题栏（带关闭按钮）
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    `;

    const title = document.createElement('span');
    title.textContent = '🎧 声道控制';
    title.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: #333;
    `;

    // 关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: #666;
      font-size: 18px;
      cursor: pointer;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
      line-height: 1;
    `;

    closeButton.addEventListener('click', () =>
    {
      hidePanel();
    });

    closeButton.addEventListener('mouseenter', () =>
    {
      closeButton.style.background = '#f0f0f0';
      closeButton.style.color = '#333';
    });

    closeButton.addEventListener('mouseleave', () =>
    {
      closeButton.style.background = 'transparent';
      closeButton.style.color = '#666';
    });

    header.appendChild(title);
    header.appendChild(closeButton);

    // 平衡控制区域
    const balanceSection = createBalanceControl();

    // 分隔线
    const divider = document.createElement('div');
    divider.style.cssText = `
      height: 1px;
      background: linear-gradient(to right, transparent, #ddd, transparent);
      margin: 4px 0;
    `;

    // 独立音量控制区域
    const volumeSection = createVolumeControls();

    // 按钮区域
    const buttonSection = createButtonControls();

    container.appendChild(header);
    container.appendChild(balanceSection);
    container.appendChild(divider);
    container.appendChild(volumeSection);
    container.appendChild(buttonSection);

    wrapper.appendChild(container);
    return wrapper;
  }

  // 切换面板显示/隐藏
  function togglePanel()
  {
    if (isPanelVisible)
    {
      hidePanel();
    } else
    {
      showPanel();
    }
  }

  // 显示面板
  function showPanel()
  {
    if (panelElement)
    {
      panelElement.style.display = 'block';
      isPanelVisible = true;
    }
  }

  // 隐藏面板
  function hidePanel()
  {
    if (panelElement)
    {
      panelElement.style.display = 'none';
      isPanelVisible = false;
    }
  }

  // 创建平衡控制
  function createBalanceControl(): HTMLElement
  {
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // 标签和值显示
    const labelRow = document.createElement('div');
    labelRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #666;
    `;
    labelRow.innerHTML = `
      <span>声道平衡</span>
      <span id="balance-value" style="font-weight: 600; color: #00bfa5;">居中</span>
    `;

    // 滑块容器
    const sliderContainer = document.createElement('div');
    sliderContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    // 左标签
    const leftLabel = document.createElement('span');
    leftLabel.textContent = 'L';
    leftLabel.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #2196f3;
      min-width: 16px;
    `;

    // 平衡滑块
    const balanceSlider = document.createElement('input');
    balanceSlider.type = 'range';
    balanceSlider.id = 'balance-slider';
    balanceSlider.min = '-100';
    balanceSlider.max = '100';
    balanceSlider.value = '0';
    balanceSlider.style.cssText = `
      flex: 1;
      height: 6px;
      border-radius: 3px;
      outline: none;
      -webkit-appearance: none;
      background: linear-gradient(to right, #2196f3 0%, #00bfa5 50%, #ff9800 100%);
      cursor: pointer;
    `;

    // 滑块样式
    if (!document.getElementById('channel-control-styles'))
    {
      const style = document.createElement('style');
      style.id = 'channel-control-styles';
      style.textContent = `
        #balance-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 3px solid #00bfa5;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s;
        }
        #balance-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          border-color: #00897b;
        }
        #balance-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 3px solid #00bfa5;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s;
        }
        #balance-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          border-color: #00897b;
        }
        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          border: 2px solid currentColor;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .volume-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          border: 2px solid currentColor;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
      `;
      document.head.appendChild(style);
    }

    // 右标签
    const rightLabel = document.createElement('span');
    rightLabel.textContent = 'R';
    rightLabel.style.cssText = `
      font-size: 12px;
      font-weight: 600;
      color: #ff9800;
      min-width: 16px;
      text-align: right;
    `;

    // 平衡滑块事件
    balanceSlider.addEventListener('input', (e) =>
    {
      const value = parseInt((e.target as HTMLInputElement).value);
      balance = value / 100;
      updateBalanceDisplay(value);
      applyAudioSettings();
    });

    sliderContainer.appendChild(leftLabel);
    sliderContainer.appendChild(balanceSlider);
    sliderContainer.appendChild(rightLabel);

    section.appendChild(labelRow);
    section.appendChild(sliderContainer);

    return section;
  }

  // 创建音量控制
  function createVolumeControls(): HTMLElement
  {
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    // 左声道控制
    const leftControl = createVolumeSlider('left', 'L', '#2196f3', '◀️');
    // 右声道控制
    const rightControl = createVolumeSlider('right', 'R', '#ff9800', '▶️');

    section.appendChild(leftControl);
    section.appendChild(rightControl);

    return section;
  }

  // 创建单个音量滑块
  function createVolumeSlider(channel: string, label: string, color: string, icon: string): HTMLElement
  {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;

    // 标签行
    const labelRow = document.createElement('div');
    labelRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #666;
    `;
    labelRow.innerHTML = `
      <span>${icon} ${label}声道</span>
      <span id="${channel}-volume-value" style="font-weight: 600; color: ${color};">100%</span>
    `;

    // 滑块容器
    const sliderContainer = document.createElement('div');
    sliderContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    // 音量滑块
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `${channel}-volume-slider`;
    slider.className = 'volume-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = '100';
    slider.style.cssText = `
      flex: 1;
      height: 4px;
      border-radius: 2px;
      outline: none;
      -webkit-appearance: none;
      background: linear-gradient(to right, ${color} 0%, ${color} 100%);
      cursor: pointer;
      color: ${color};
    `;

    // 滑块事件
    slider.addEventListener('input', (e) =>
    {
      const value = parseInt((e.target as HTMLInputElement).value);
      if (channel === 'left')
      {
        leftVolume = value / 100;
      } else
      {
        rightVolume = value / 100;
      }
      updateVolumeDisplay(channel, value);
      applyAudioSettings();
    });

    sliderContainer.appendChild(slider);
    container.appendChild(labelRow);
    container.appendChild(sliderContainer);

    return container;
  }

  // 创建按钮控制
  function createButtonControls(): HTMLElement
  {
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex;
      gap: 8px;
      margin-top: 4px;
    `;

    // 反转按钮
    const swapButton = document.createElement('button');
    swapButton.id = 'swap-channel-btn';
    swapButton.textContent = '🔄 反转声道';
    swapButton.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      background: ${isSwapped ? '#ff5252' : '#f5f5f5'};
      color: ${isSwapped ? 'white' : '#333'};
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;

    swapButton.addEventListener('click', () =>
    {
      isSwapped = !isSwapped;
      swapButton.style.background = isSwapped ? '#ff5252' : '#f5f5f5';
      swapButton.style.color = isSwapped ? 'white' : '#333';
      applyAudioSettings();
    });

    swapButton.addEventListener('mouseenter', () =>
    {
      if (!isSwapped)
      {
        swapButton.style.background = '#e0e0e0';
      }
    });

    swapButton.addEventListener('mouseleave', () =>
    {
      swapButton.style.background = isSwapped ? '#ff5252' : '#f5f5f5';
    });

    // 重置按钮
    const resetButton = document.createElement('button');
    resetButton.textContent = '↺ 重置';
    resetButton.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      background: #f5f5f5;
      color: #333;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    `;

    resetButton.addEventListener('click', () =>
    {
      resetAllSettings();
    });

    resetButton.addEventListener('mouseenter', () =>
    {
      resetButton.style.background = '#e0e0e0';
    });

    resetButton.addEventListener('mouseleave', () =>
    {
      resetButton.style.background = '#f5f5f5';
    });

    section.appendChild(swapButton);
    section.appendChild(resetButton);

    return section;
  }

  // 更新平衡显示
  function updateBalanceDisplay(value: number)
  {
    const display = document.getElementById('balance-value');
    if (!display) return;

    if (value === 0)
    {
      display.textContent = '居中';
      display.style.color = '#00bfa5';
    } else if (value < 0)
    {
      display.textContent = `左 ${Math.abs(value)}%`;
      display.style.color = '#2196f3';
    } else
    {
      display.textContent = `右 ${value}%`;
      display.style.color = '#ff9800';
    }
  }

  // 更新音量显示
  function updateVolumeDisplay(channel: string, value: number)
  {
    const display = document.getElementById(`${channel}-volume-value`);
    if (display)
    {
      display.textContent = `${value}%`;
    }
  }

  // 重置所有设置
  function resetAllSettings()
  {
    // 重置变量
    leftVolume = 1.0;
    rightVolume = 1.0;
    balance = 0;
    isSwapped = false;

    // 重置UI
    const balanceSlider = document.getElementById('balance-slider') as HTMLInputElement;
    if (balanceSlider) balanceSlider.value = '0';
    updateBalanceDisplay(0);

    const leftSlider = document.getElementById('left-volume-slider') as HTMLInputElement;
    if (leftSlider) leftSlider.value = '100';
    updateVolumeDisplay('left', 100);

    const rightSlider = document.getElementById('right-volume-slider') as HTMLInputElement;
    if (rightSlider) rightSlider.value = '100';
    updateVolumeDisplay('right', 100);

    const swapButton = document.getElementById('swap-channel-btn') as HTMLButtonElement;
    if (swapButton)
    {
      swapButton.style.background = '#f5f5f5';
      swapButton.style.color = '#333';
    }

    // 应用设置
    applyAudioSettings();
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

      // 创建增益节点用于控制音量
      gainNodeLeft = audioContext.createGain();
      gainNodeRight = audioContext.createGain();

      // 连接节点：音频源 -> 分离器
      sourceNode.connect(splitter);

      // 应用当前设置
      applyAudioSettings();

      // 连接到输出
      merger.connect(audioContext.destination);

      currentAudioElement = audioElement;

      console.log('音频处理初始化成功');
    } catch (error)
    {
      console.error('音频处理初始化失败:', error);
    }
  }

  // 应用音频设置
  function applyAudioSettings()
  {
    if (!splitter || !merger || !gainNodeLeft || !gainNodeRight) return;

    // 断开所有连接
    splitter.disconnect();
    gainNodeLeft.disconnect();
    gainNodeRight.disconnect();

    // 计算最终的左右声道增益
    // 平衡值影响：balance = -1 (全左) 到 1 (全右)
    // balance < 0: 右声道音量降低，左声道获得右声道的部分音量
    // balance > 0: 左声道音量降低，右声道获得左声道的部分音量

    let finalLeftGain = leftVolume;
    let finalRightGain = rightVolume;

    // 应用平衡效果
    if (balance < 0)
    {
      // 向左平衡：右声道音量降低，左声道增加
      const balanceFactor = Math.abs(balance);
      finalRightGain *= (1 - balanceFactor);
      finalLeftGain *= (1 + balanceFactor * 0.5); // 左声道适度增加
    } else if (balance > 0)
    {
      // 向右平衡：左声道音量降低，右声道增加
      const balanceFactor = balance;
      finalLeftGain *= (1 - balanceFactor);
      finalRightGain *= (1 + balanceFactor * 0.5); // 右声道适度增加
    }

    // 设置增益值
    gainNodeLeft.gain.value = finalLeftGain;
    gainNodeRight.gain.value = finalRightGain;

    // 根据是否反转来连接声道
    if (isSwapped)
    {
      // 反转模式：左->右，右->左
      splitter.connect(gainNodeLeft, 1);  // 右声道数据 -> 左增益节点
      splitter.connect(gainNodeRight, 0); // 左声道数据 -> 右增益节点
      gainNodeLeft.connect(merger, 0, 0);  // 左增益 -> 左输出
      gainNodeRight.connect(merger, 0, 1); // 右增益 -> 右输出
    } else
    {
      // 正常模式：左->左，右->右
      splitter.connect(gainNodeLeft, 0);   // 左声道数据 -> 左增益节点
      splitter.connect(gainNodeRight, 1);  // 右声道数据 -> 右增益节点
      gainNodeLeft.connect(merger, 0, 0);  // 左增益 -> 左输出
      gainNodeRight.connect(merger, 0, 1); // 右增益 -> 右输出
    }

    console.log(`音频设置已应用 - 左:${finalLeftGain.toFixed(2)}, 右:${finalRightGain.toFixed(2)}, 平衡:${balance.toFixed(2)}, 反转:${isSwapped}`);
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
    if (gainNodeLeft)
    {
      gainNodeLeft.disconnect();
      gainNodeLeft = null;
    }
    if (gainNodeRight)
    {
      gainNodeRight.disconnect();
      gainNodeRight = null;
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
  }

  // 监听音频元素并插入按钮和面板
  function observeAudioElements()
  {
    const triggerButton = createTriggerButton();
    const panel = createChannelControlPanel();
    panelElement = panel;

    let buttonInserted = false;
    let panelInserted = false;

    // 尝试将按钮插入到播放器控制栏
    const insertButtonToPlayer = () =>
    {
      if (buttonInserted) return;

      // 查找播放控制按钮组
      let controlRow: Element | null = null;

      // 方法1: 查找包含播放控制按钮的行
      const rows = document.querySelectorAll('[data-v-627ee493].row');
      for (const row of rows)
      {
        const icons = row.querySelectorAll('.material-icons');
        const hasPlayControls = Array.from(icons).some(icon =>
          ['skip_previous', 'skip_next', 'pause', 'play_arrow', 'replay_5', 'forward_30'].includes(icon.textContent?.trim() || '')
        );

        if (hasPlayControls)
        {
          controlRow = row;
          console.log('找到播放控制栏（通过图标匹配）');
          break;
        }
      }

      // 方法2: 使用特定的类名选择器作为备选
      if (!controlRow)
      {
        controlRow =
          document.querySelector('.row.flex-center') ||
          document.querySelector('.row.q-py-md.self-center') ||
          document.querySelector('.row.items-center.q-mx-lg.q-pt-sm') ||
          document.querySelector('.row.items-center.q-gutter-x-sm') ||
          null;
      }

      if (controlRow)
      {
        // 检测是否为移动端布局
        const isMobile = controlRow.classList.contains('q-py-md') ||
          controlRow.classList.contains('self-center');

        if (isMobile)
        {
          // 移动端：创建一个新的居中行来放置按钮
          const centerRow = document.createElement('div');
          centerRow.className = 'row justify-center';
          centerRow.setAttribute('data-v-627ee493', '');
          centerRow.style.cssText = 'margin-top: -36px; margin-bottom: -18px;';
          centerRow.appendChild(triggerButton);

          if (controlRow.parentNode && controlRow.nextSibling)
          {
            controlRow.parentNode.insertBefore(centerRow, controlRow.nextSibling);
          }
          else if (controlRow.parentNode)
          {
            controlRow.parentNode.appendChild(centerRow);
          }

          console.log('声道控制按钮已成功插入到播放器（移动端居中）');
        }
        else
        {
          // PC端：直接追加到播放控制按钮组的最后
          controlRow.appendChild(triggerButton);
          console.log('声道控制按钮已成功插入到播放器（PC端）');
        }

        buttonInserted = true;
      }
    };

    // 插入控制面板到页面
    const insertPanelToPage = () =>
    {
      if (panelInserted) return;

      document.body.appendChild(panel);
      panelInserted = true;
      console.log('声道控制面板已成功插入到页面');
    };

    // 检查音频元素的函数
    const checkAudioElements = () =>
    {
      const audioElements = document.querySelectorAll('audio');

      if (audioElements.length > 0)
      {
        // 尝试插入按钮和面板
        insertButtonToPlayer();
        insertPanelToPage();

        audioElements.forEach((audio) =>
        {
          // 监听播放事件
          if (!audio.dataset.channelControlListenerAdded)
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

            audio.dataset.channelControlListenerAdded = 'true';
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

  console.log('ASMR声道控制脚本已加载');
})();
