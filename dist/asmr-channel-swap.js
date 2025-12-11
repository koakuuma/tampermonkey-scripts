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
// 在ASMR网站上添加音频声道反转功能，支持一键切换左右声道

(function () {
  'use strict';

  // 声道反转状态
  let isChannelSwapped = false;
  let audioContext = null;
  let sourceNode = null;
  let splitter = null;
  let merger = null;
  let currentAudioElement = null;

  // 创建声道反转按钮
  function createSwapButton() {
    const button = document.createElement('button');
    button.id = 'channel-swap-btn';
    button.innerHTML = '🔄 声道正常';
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
      display: none;
    `;

    // 鼠标悬停效果
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    });

    // 点击事件
    button.addEventListener('click', toggleChannelSwap);
    document.body.appendChild(button);
    return button;
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

      // 正常连接（左->左，右->右）
      splitter.connect(merger, 0, 0); // 左声道 -> 左输出
      splitter.connect(merger, 1, 1); // 右声道 -> 右输出

      // 连接到输出
      merger.connect(audioContext.destination);
      currentAudioElement = audioElement;
      console.log('音频处理初始化成功');
    } catch (error) {
      console.error('音频处理初始化失败:', error);
    }
  }

  // 切换声道
  function toggleChannelSwap() {
    if (!audioContext || !splitter || !merger || !currentAudioElement) {
      console.error('音频处理未初始化');
      return;
    }
    try {
      // 断开所有连接
      splitter.disconnect();
      if (!isChannelSwapped) {
        // 反转声道（左->右，右->左）
        splitter.connect(merger, 0, 1); // 左声道 -> 右输出
        splitter.connect(merger, 1, 0); // 右声道 -> 左输出
        isChannelSwapped = true;

        // 更新按钮状态
        const button = document.getElementById('channel-swap-btn');
        if (button) {
          button.innerHTML = '🔄 声道反转';
          button.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        }
        console.log('声道已反转');
      } else {
        // 恢复正常（左->左，右->右）
        splitter.connect(merger, 0, 0); // 左声道 -> 左输出
        splitter.connect(merger, 1, 1); // 右声道 -> 右输出
        isChannelSwapped = false;

        // 更新按钮状态
        const button = document.getElementById('channel-swap-btn');
        if (button) {
          button.innerHTML = '🔄 声道正常';
          button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
        console.log('声道已恢复正常');
      }
    } catch (error) {
      console.error('切换声道失败:', error);
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
    isChannelSwapped = false;
  }

  // 监听音频元素
  function observeAudioElements() {
    const button = createSwapButton();

    // 检查音频元素的函数
    const checkAudioElements = () => {
      const audioElements = document.querySelectorAll('audio');
      if (audioElements.length > 0) {
        audioElements.forEach(audio => {
          // 监听播放事件
          if (!audio.dataset.channelSwapListenerAdded) {
            audio.addEventListener('play', () => {
              console.log('检测到音频播放');
              button.style.display = 'block';

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
              button.style.display = 'none';
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
  console.log('ASMR声道反转脚本已加载');
})();
/******/ })()
;