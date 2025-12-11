// ==UserScript==
// @name         ASMR音频声道反转
// @namespace    https://github.com/shangxueink
// @version      1.0
// @description  在ASMR网站上添加音频声道反转功能，支持一键切换左右声道
// @author       shangxueink
// @license      MIT
// @match        https://www.asmr.one/work/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=asmr.one
// @grant        none
// @run-at       document-end
// @homepageURL  https://github.com/koakuuma/tampermonkey-scripts
// @supportURL   https://github.com/koakuuma/tampermonkey-scripts/issues
// @downloadURL  https://github.com/koakuuma/tampermonkey-scripts/raw/main/dist/asmr-channel-swap.user.js
// @updateURL    https://github.com/koakuuma/tampermonkey-scripts/raw/main/dist/asmr-channel-swap.user.js
// ==/UserScript==
/******/ (() => { // webpackBootstrap
// ASMR音频声道反转脚本
// 在ASMR网站上添加音频声道反转功能，支持多种声道模式切换

(function () {
  'use strict';

  // 声道模式枚举
  const ChannelMode = {
    NORMAL: 'normal',
    // 正常声道
    SWAP: 'swap',
    // 反转声道
    LEFT_ONLY: 'left',
    // 仅左声道
    RIGHT_ONLY: 'right' // 仅右声道
  };

  // 当前声道模式
  let currentMode = ChannelMode.NORMAL;
  let audioContext = null;
  let sourceNode = null;
  let splitter = null;
  let merger = null;
  let currentAudioElement = null;

  // 创建声道选择下拉框
  function createChannelSelector() {
    const container = document.createElement('div');
    container.id = 'channel-selector-container';
    container.className = 'q-btn-dropdown q-btn-dropdown--simple';
    container.style.cssText = 'position: relative; display: inline-block;';
    container.setAttribute('data-v-627ee493', '');

    // 创建触发按钮
    const button = document.createElement('button');
    button.id = 'channel-selector-btn';
    button.tabIndex = 0;
    button.type = 'button';
    button.className = 'q-btn q-btn-item non-selectable no-outline col-auto q-btn--flat q-btn--rectangle q-btn--actionable q-focusable q-hoverable q-btn--wrap q-btn--dense q-px-xs';
    button.style.cssText = 'font-size: 20px;';
    button.setAttribute('data-v-627ee493', '');
    button.innerHTML = `
      <span class="q-focus-helper"></span>
      <span class="q-btn__wrapper col row q-anchor--skip">
        <span class="q-btn__content text-center col items-center q-anchor--skip justify-center row">
          <i aria-hidden="true" role="img" class="q-icon notranslate material-icons" style="color: #00bfa5;">swap_horiz</i>
          <i aria-hidden="true" role="img" class="q-icon notranslate material-icons" style="font-size: 14px; margin-left: 2px;">arrow_drop_down</i>
        </span>
      </span>
    `;

    // 创建下拉菜单
    const dropdown = document.createElement('div');
    dropdown.id = 'channel-dropdown';
    dropdown.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
      min-width: 150px;
      margin-top: 4px;
    `;

    // 创建选项
    const options = [{
      value: ChannelMode.NORMAL,
      label: '🔊 正常声道',
      color: '#00bfa5'
    }, {
      value: ChannelMode.SWAP,
      label: '🔄 反转声道',
      color: '#ff5252'
    }, {
      value: ChannelMode.LEFT_ONLY,
      label: '◀️ 仅左声道',
      color: '#2196f3'
    }, {
      value: ChannelMode.RIGHT_ONLY,
      label: '▶️ 仅右声道',
      color: '#ff9800'
    }];
    options.forEach(option => {
      const item = document.createElement('div');
      item.className = 'channel-option';
      item.dataset.value = option.value;
      item.textContent = option.label;
      item.style.cssText = `
        padding: 10px 16px;
        cursor: pointer;
        transition: background-color 0.2s;
        font-size: 14px;
        color: #333;
      `;
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f5f5f5';
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = currentMode === option.value ? '#e3f2fd' : 'white';
      });
      item.addEventListener('click', () => {
        switchChannelMode(option.value);
        updateButtonIcon(option.color);
        dropdown.style.display = 'none';

        // 更新选中状态
        dropdown.querySelectorAll('.channel-option').forEach(opt => {
          opt.style.backgroundColor = 'white';
        });
        item.style.backgroundColor = '#e3f2fd';
      });

      // 如果是当前模式，高亮显示
      if (option.value === currentMode) {
        item.style.backgroundColor = '#e3f2fd';
      }
      dropdown.appendChild(item);
    });

    // 点击按钮切换下拉菜单显示
    button.addEventListener('click', e => {
      e.stopPropagation();
      const isVisible = dropdown.style.display === 'block';
      dropdown.style.display = isVisible ? 'none' : 'block';
    });

    // 点击页面其他地方关闭下拉菜单
    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });
    container.appendChild(button);
    container.appendChild(dropdown);
    return container;
  }

  // 更新按钮图标颜色
  function updateButtonIcon(color) {
    const button = document.getElementById('channel-selector-btn');
    if (button) {
      const icon = button.querySelector('.material-icons');
      if (icon) {
        icon.style.color = color;
      }
    }
  }

  // 初始化音频处理
  function initAudioProcessing(audioElement) {
    try {
      // 如果已经初始化过，先清理
      if (audioContext && sourceNode) {
        cleanupAudioProcessing();
      }

      // 创建音频上下文
      audioContext = new (window.AudioContext || window.webkitAudioContext)();

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
    } catch (error) {
      console.error('音频处理初始化失败:', error);
    }
  }

  // 应用声道模式
  function applyChannelMode(mode) {
    if (!splitter || !merger) return;

    // 断开所有连接
    splitter.disconnect();
    switch (mode) {
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
  function switchChannelMode(mode) {
    if (!audioContext || !splitter || !merger || !currentAudioElement) {
      console.error('音频处理未初始化');
      return;
    }
    try {
      currentMode = mode;
      applyChannelMode(mode);
    } catch (error) {
      console.error('切换声道模式失败:', error);
    }
  }

  // 清理音频处理
  function cleanupAudioProcessing() {
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (splitter) {
      splitter.disconnect();
      splitter = null;
    }
    if (merger) {
      merger.disconnect();
      merger = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    currentAudioElement = null;
    currentMode = ChannelMode.NORMAL;
  }

  // 监听音频元素并插入选择器到播放器
  function observeAudioElements() {
    const selector = createChannelSelector();
    let selectorInserted = false;

    // 尝试将选择器插入到播放器控制栏
    const insertSelectorToPlayer = () => {
      if (selectorInserted) return;

      // 查找播放控制按钮组（PC端和移动端）
      const controlRow = document.querySelector('.row.flex-center') || document.querySelector('.row.q-py-md.self-center');
      if (controlRow && controlRow.querySelector('button')) {
        // 插入到播放控制按钮组的最后
        controlRow.appendChild(selector);
        selectorInserted = true;
        console.log('声道选择器已插入到播放器');
      }
    };

    // 检查音频元素的函数
    const checkAudioElements = () => {
      const audioElements = document.querySelectorAll('audio');
      if (audioElements.length > 0) {
        // 尝试插入选择器
        insertSelectorToPlayer();
        audioElements.forEach(audio => {
          // 监听播放事件
          if (!audio.dataset.channelSwapListenerAdded) {
            audio.addEventListener('play', () => {
              console.log('检测到音频播放');

              // 初始化音频处理
              if (!sourceNode || currentAudioElement !== audio) {
                initAudioProcessing(audio);
              }
            });
            audio.addEventListener('pause', () => {
              console.log('音频暂停');
            });
            audio.addEventListener('ended', () => {
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
    const observer = new MutationObserver(mutations => {
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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAudioElements);
  } else {
    observeAudioElements();
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    cleanupAudioProcessing();
  });
  console.log('ASMR声道切换脚本已加载');
})();
/******/ })()
;