

// Gateway Auto Login - 网关自动登录

(function ()
{
  'use strict';

  // 从localStorage获取保存的配置
  interface GatewayConfig
  {
    autologin: boolean;
    loginfo: boolean;
    username: string;
    password: string;
    operator: number;
    typingSpeed: number;
    refreshInterval: number;
    maxRefreshAttempts: number;
  }

  const savedConfig = JSON.parse(localStorage.getItem('gatewayAutoLoginConfig') || '{}') as Partial<GatewayConfig>;

  // 配置项 - 合并默认配置和保存的配置
  const CONFIG: GatewayConfig = {
    autologin: savedConfig.autologin !== undefined ? savedConfig.autologin : true,  // 是否启用自动登录，默认开启
    loginfo: savedConfig.loginfo !== undefined ? savedConfig.loginfo : false,       // 是否开启日志调试模式，默认关闭
    username: savedConfig.username || '',       // 教职工号或学号
    password: savedConfig.password || '',       // 密码
    operator: savedConfig.operator !== undefined ? savedConfig.operator : 2,  // 运营商选择: 0=校园网, 1=中国移动, 2=中国联通, 3=中国电信
    typingSpeed: savedConfig.typingSpeed !== undefined ? savedConfig.typingSpeed : 5, // 输入速度: 1=超慢, 2=慢, 3=中等, 4=稍快, 5=快, 6=极速
    refreshInterval: savedConfig.refreshInterval !== undefined ? savedConfig.refreshInterval : 60, // 刷新间隔，默认60秒
    maxRefreshAttempts: savedConfig.maxRefreshAttempts !== undefined ? savedConfig.maxRefreshAttempts : 30 // 最大刷新次数，默认3次
  };

  const OPERATORS = ['校园网', '中国移动', '中国联通', '中国电信'];

  // 添加刷新计时器变量和计数器
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshAttempts = 0;

  // 启动自动刷新计时器的函数
  function startAutoRefreshTimer()
  {
    // 清除可能存在的旧计时器
    if (refreshTimer)
    {
      clearTimeout(refreshTimer);
    }

    // 重置计数器
    refreshAttempts = 0;

    // 设置新计时器
    scheduleNextRefresh();

    log(`自动刷新计时器已启动，间隔 ${CONFIG.refreshInterval} 秒`);
  }

  // 安排下一次刷新的函数
  function scheduleNextRefresh()
  {
    if (refreshAttempts >= CONFIG.maxRefreshAttempts)
    {
      log(`已达到最大刷新次数 (${CONFIG.maxRefreshAttempts})，停止自动刷新`);
      return;
    }

    refreshTimer = setTimeout(() =>
    {
      // 检查是否已登录，如果已登录则不刷新
      if (checkLoginStatus())
      {
        log('已成功登录，取消自动刷新');
        return;
      }

      refreshAttempts++;
      log(`执行第 ${refreshAttempts} 次自动刷新`);

      // 强制刷新页面
      window.location.reload();
    }, CONFIG.refreshInterval * 1000);
  }

  // 保存配置到localStorage
  function saveConfig()
  {
    localStorage.setItem('gatewayAutoLoginConfig', JSON.stringify(CONFIG));
    log('配置已保存');
  }

  function getTypingDelay()
  {
    let min, max;
    switch (CONFIG.typingSpeed)
    {
      case 1: min = 200; max = 400; break; // 超慢
      case 2: min = 100; max = 300; break; // 慢
      case 3: min = 50; max = 150; break;  // 中等
      case 4: min = 20; max = 80; break;   // 稍快
      case 5: min = 5; max = 15; break;    // 快
      case 6: min = 1; max = 5; break;     // 极速
      default: min = 20; max = 80; break;  // 默认稍快
    }
    return { min: min, max: max };
  }

  function log(message: string): void
  {
    if (CONFIG.loginfo)
    {
      console.log(`[Gateway Auto Login]: ${message}`);
    }
  }

  // 创建配置界面
  function createConfigInterface()
  {
    const configHTML = `
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; font-size: 18px;">
                <h2 style="text-align: center; color: #333;">网关自动登录 - 配置页</h2>
                <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">教职工号/学号:</label>
                        <input id="config-username" type="text" value="${CONFIG.username}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 16px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; font-size: 16px;">密码:</label>
                        <input id="config-password" type="password" value="${CONFIG.password}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 16px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">运营商:</label>
                        <select id="config-operator" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 16px;">
                            <option value="0" ${CONFIG.operator === 0 ? 'selected' : ''}>校园网</option>
                            <option value="1" ${CONFIG.operator === 1 ? 'selected' : ''}>中国移动</option>
                            <option value="2" ${CONFIG.operator === 2 ? 'selected' : ''}>中国联通</option>
                            <option value="3" ${CONFIG.operator === 3 ? 'selected' : ''}>中国电信</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">输入速度:</label>
                        <select id="config-typing-speed" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 16px;">
                            <option value="1" ${CONFIG.typingSpeed === 1 ? 'selected' : ''}>超慢</option>
                            <option value="2" ${CONFIG.typingSpeed === 2 ? 'selected' : ''}>慢</option>
                            <option value="3" ${CONFIG.typingSpeed === 3 ? 'selected' : ''}>中等</option>
                            <option value="4" ${CONFIG.typingSpeed === 4 ? 'selected' : ''}>稍快</option>
                            <option value="5" ${CONFIG.typingSpeed === 5 ? 'selected' : ''}>快</option>
                            <option value="6" ${CONFIG.typingSpeed === 6 ? 'selected' : ''}>极速</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input id="config-autologin" type="checkbox" ${CONFIG.autologin ? 'checked' : ''} style="margin-right: 8px;">
                            <span>启用自动登录（请保持开启）</span>
                        </label>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input id="config-loginfo" type="checkbox" ${CONFIG.loginfo ? 'checked' : ''} style="margin-right: 8px;">
                            <span>启用调试日志（debug模式）</span>
                        </label>
                    </div>
     
                    <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">自动刷新间隔 (秒):</label>
        <input id="config-refresh-interval" type="number" value="${CONFIG.refreshInterval}" min="10" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 16px;">
    </div>
    <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-weight: bold;">最大刷新次数:</label>
        <input id="config-max-refresh" type="number" value="${CONFIG.maxRefreshAttempts}" min="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 16px;">
    </div>
     
                    <button id="save-config" style="width: 100%; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;">保存配置并登录</button>
                    <p style="margin-top: 15px; font-size: 12px; color: #666; text-align: center;">配置将保存在浏览器本地，下次访问时自动使用</p>
                </div>
            </div>
            `;

    document.body.innerHTML = configHTML;

    // 添加保存配置的事件监听
    document.getElementById('save-config')!.addEventListener('click', function ()
    {
      CONFIG.username = (document.getElementById('config-username') as HTMLInputElement).value;
      CONFIG.password = (document.getElementById('config-password') as HTMLInputElement).value;
      CONFIG.operator = parseInt((document.getElementById('config-operator') as HTMLSelectElement).value);
      CONFIG.typingSpeed = parseInt((document.getElementById('config-typing-speed') as HTMLSelectElement).value);
      CONFIG.autologin = (document.getElementById('config-autologin') as HTMLInputElement).checked;
      CONFIG.loginfo = (document.getElementById('config-loginfo') as HTMLInputElement).checked;
      CONFIG.refreshInterval = parseInt((document.getElementById('config-refresh-interval') as HTMLInputElement).value) || 60;
      CONFIG.maxRefreshAttempts = parseInt((document.getElementById('config-max-refresh') as HTMLInputElement).value) || 3;

      // 确保刷新间隔不小于10秒
      if (CONFIG.refreshInterval < 10)
      {
        CONFIG.refreshInterval = 10;
      }

      saveConfig();

      // 重新加载页面以应用新配置
      window.location.reload();
    });
  }

  function simulateRealTyping(element: HTMLInputElement, text: string): Promise<void>
  {
    return new Promise((resolve) =>
    {
      element.value = '';
      element.focus();

      element.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));

      const delay = getTypingDelay();

      if (CONFIG.typingSpeed === 6)
      { // 极速模式
        element.value = text;

        element.dispatchEvent(new Event('input', {
          bubbles: true,
          cancelable: true
        }));

        element.dispatchEvent(new Event('change', {
          bubbles: true,
          cancelable: true
        }));

        setTimeout(resolve, 50);
        return;
      }

      let i = 0;
      function typeNextChar()
      {
        if (i < text.length)
        {
          const char = text[i];
          const currentValue = element.value;
          element.value = currentValue + char;

          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: char,
            inputType: 'insertText',
            view: window
          });
          element.dispatchEvent(inputEvent);

          i++;
          setTimeout(typeNextChar, delay.min + Math.random() * (delay.max - delay.min));
        } else
        {
          const changeEvent = new Event('change', {
            bubbles: true,
            cancelable: true
          });
          element.dispatchEvent(changeEvent);

          resolve();
        }
      }

      typeNextChar();
    });
  }

  async function autoLogin()
  {
    log('自动登录脚本开始运行...');

    // 检查是否启用自动登录
    if (!CONFIG.autologin)
    {
      log('自动登录已关闭，脚本停止运行。');
      return;
    }

    // 检查账号密码是否为空
    if (!CONFIG.username || !CONFIG.password)
    {
      log('账号或密码未配置，显示配置界面');
      createConfigInterface();
      return; // 停止执行后续登录逻辑
    }

    const successElement = document.querySelector('div[name="PageTips"]');
    if (successElement && successElement.textContent.includes('您已经成功登录'))
    {
      log('已经登录，无需使用快速登录');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    const usernameInput = document.querySelector('input[name="DDDDD"][type="text"][maxlength="30"]') as HTMLInputElement | null;
    const passwordInput = document.querySelector('input[name="upass"][type="password"][maxlength="30"]') as HTMLInputElement | null;
    const operatorSelect = document.querySelector('select[name="ISP_select"]') as HTMLSelectElement | null;
    const loginButton = document.querySelector('input[name="0MKKey"][type="button"][value="登录"]');

    if (!usernameInput || !passwordInput || !operatorSelect || !loginButton)
    {
      console.error('未找到必要的表单元素，请检查页面结构是否变化');
      return;
    }

    log('已找到所有表单元素，开始填写...');
    log('正在输入用户名...');
    await simulateRealTyping(usernameInput, CONFIG.username);

    await new Promise(resolve => setTimeout(resolve, 100));

    log('正在输入密码...');
    await simulateRealTyping(passwordInput, CONFIG.password);

    await new Promise(resolve => setTimeout(resolve, 100));

    log('正在选择运营商...');

    if (CONFIG.operator >= 0 && CONFIG.operator < OPERATORS.length)
    {
      const operatorText = OPERATORS[CONFIG.operator];
      let operatorFound = false;
      for (let i = 0; i < operatorSelect.options.length; i++)
      {
        if (operatorSelect.options[i].text === operatorText)
        {
          operatorSelect.selectedIndex = i;
          operatorFound = true;

          const changeEvent = new Event('change', {
            bubbles: true,
            cancelable: true
          });
          operatorSelect.dispatchEvent(changeEvent);

          log(`已选择运营商: ${operatorText}`);
          break;
        }
      }

      if (!operatorFound)
      {
        log('未找到指定的运营商，将使用默认选项');
      }
    } else
    {
      log('运营商配置错误，将使用默认选项');
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    log('正在点击登录按钮...');
    loginButton.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    log('登录请求已发送，请等待响应...');
  }

  // 添加一个配置按钮到页面上
  function addConfigButton()
  {
    let retryCount = 0;
    const maxRetries = 10; // 最大重试次数

    function attemptToAddButton()
    {
      // 使用更宽松的选择器
      const loginButton = document.querySelector('input[name="0MKKey"][type="button"][value="登录"]') as HTMLInputElement | null;
      const logoutButton = document.querySelector('input[name="logout"][type="button"][value="注  销"]') as HTMLInputElement | null;

      // 确定参考按钮
      const referenceButton = loginButton || logoutButton;

      if (!referenceButton)
      {
        retryCount++;
        log(`未找到登录或注销按钮，重试中... (第 ${retryCount} 次)`);

        if (retryCount >= maxRetries)
        {
          console.error('多次尝试后仍未找到登录或注销按钮，停止添加配置按钮');
          return;
        }

        setTimeout(attemptToAddButton, 1000); // 每1秒重试一次
        return;
      }

      // 创建配置按钮，复制参考按钮的样式
      const button = document.createElement('input');
      button.type = 'button';
      button.value = '配置自动登录';

      // 复制参考按钮的所有样式
      const computedStyle = window.getComputedStyle(referenceButton);
      for (let i = 0; i < computedStyle.length; i++)
      {
        const prop = computedStyle[i];
        (button.style as any)[prop] = computedStyle.getPropertyValue(prop);
      }

      // 设置按钮位置 - 在参考按钮上方
      let topOffset = (loginButton) ? 216 : 50; // 根据按钮类型设置不同的偏移量
      const topPosition = parseInt(referenceButton.style.top, 10) - topOffset; // 在原按钮上方 topOffset px

      button.style.position = 'absolute';
      button.style.top = `${topPosition}px`;
      button.style.left = referenceButton.style.left;
      button.style.width = referenceButton.style.width;
      button.style.height = referenceButton.style.height;

      // 设置不同的背景色以区分
      button.style.backgroundColor = '#2196F3'; // 蓝色背景

      // 确保按钮置顶
      button.style.zIndex = '1000'; // 或者更高的值，确保不会被遮挡

      // 添加点击事件
      button.addEventListener('click', function ()
      {
        createConfigInterface();
      });

      // 添加到参考按钮的父元素中
      referenceButton.parentNode!.insertBefore(button, referenceButton);
      log('成功添加配置按钮');
    }

    // 初始延迟后尝试添加按钮
    setTimeout(attemptToAddButton, 500);
  }


  // 检查登录状态并显示通知
  function checkLoginStatus()
  {
    const successElement = document.querySelector('div[name="PageTips"]');
    if (successElement && successElement.textContent.includes('您已经成功登录'))
    {
      showNotification('已成功登录', 'success');
      return true;
    }
    return false;
  }

  // 显示通知
  function showNotification(message: string, type: 'info' | 'success' | 'error' = 'info'): void
  {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '60px';
    notification.style.right = '10px';
    notification.style.padding = '10px 15px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '10000';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.fontSize = '14px';
    notification.style.transition = 'opacity 0.5s ease-in-out';

    if (type === 'success')
    {
      notification.style.backgroundColor = '#4CAF50';
      notification.style.color = 'white';
    } else if (type === 'error')
    {
      notification.style.backgroundColor = '#f44336';
      notification.style.color = 'white';
    } else
    {
      notification.style.backgroundColor = '#2196F3';
      notification.style.color = 'white';
    }

    document.body.appendChild(notification);

    setTimeout(() =>
    {
      notification.style.opacity = '0';
      setTimeout(() =>
      {
        // 添加检查，确保元素仍然是 document.body 的子元素
        if (notification.parentNode === document.body)
        {
          document.body.removeChild(notification);
        }
      }, 500);
    }, 3000);
  }


  // 初始化函数
  function init()
  {
    log('脚本初始化...');

    // 启动自动刷新计时器
    startAutoRefreshTimer();
    // 检查当前URL，判断是哪种登录页面
    const currentURL = window.location.href;

    // 检查是否是第二种登录页面 (192.168.255.4)
    if (currentURL.includes('192.168.255.4'))
    {
      log('检测到第二种登录页面');
      handleSecondLoginPageType();
      return;
    }

    // 第一种登录页面 (172.19.0.1)
    // 先检查是否已经登录
    if (checkLoginStatus())
    {
      log('已经登录，添加配置按钮');
      addConfigButton();
      return;
    }

    // 如果未登录且有配置，尝试自动登录
    if (CONFIG.username && CONFIG.password)
    {
      log('发现有效配置，尝试自动登录');
      autoLogin().catch(error =>
      {
        console.error('自动登录出错:', error);
        showNotification('自动登录失败，请手动登录', 'error');
      });
    } else
    {
      log('未找到有效配置，显示配置界面');
      createConfigInterface();
    }

    // 无论如何都添加配置按钮
    addConfigButton();

  }

  // 处理第二种登录页面 (192.168.255.4)
  function handleSecondLoginPageType()
  {
    log('处理第二种登录页面类型');
    // 检查是否已经登录
    if (checkSecondLoginPageStatus())
    {
      log('已经登录，添加配置按钮');
      addConfigButtonForSecondPage();
      return;
    }

    // 如果未登录且有配置，尝试自动登录
    if (CONFIG.username && CONFIG.password)
    {
      log('发现有效配置，尝试自动登录');
      autoLoginForSecondPage().catch(error =>
      {
        console.error('自动登录出错:', error);
        showNotification('自动登录失败，请手动登录', 'error');
      });
    } else
    {
      log('未找到有效配置，显示配置界面');
      createConfigInterface();
    }

    // 添加配置按钮
    addConfigButtonForSecondPage();
  }

  // 检查第二种登录页面的登录状态
  function checkSecondLoginPageStatus()
  {
    const successElement = document.querySelector('div[name="PageTips"]');
    if (successElement && successElement.textContent.includes('您已经成功登录'))
    {
      showNotification('已成功登录', 'success');
      return true;
    }
    return false;
  }

  // 第二种登录页面的自动登录
  async function autoLoginForSecondPage()
  {
    log('第二种登录页面自动登录脚本开始运行...');

    // 检查是否启用自动登录
    if (!CONFIG.autologin)
    {
      log('自动登录已关闭，脚本停止运行。');
      return;
    }

    // 检查账号密码是否为空
    if (!CONFIG.username || !CONFIG.password)
    {
      log('账号或密码未配置，显示配置界面');
      createConfigInterface();
      return; // 停止执行后续登录逻辑
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // 第二种页面的元素选择器
    const usernameInput = document.querySelector('input[name="DDDDD"][maxlength="30"][placeholder="账号"]') as HTMLInputElement | null;
    const passwordInput = document.querySelector('input[name="upass"][maxlength="30"][placeholder="密码"]') as HTMLInputElement | null;
    const loginButton = document.querySelector('input[name="0MKKey"][value="登录"]');

    if (!usernameInput || !passwordInput || !loginButton)
    {
      console.error('未找到必要的表单元素，请检查页面结构是否变化');
      return;
    }

    log('已找到所有表单元素，开始填写...');
    log('正在输入用户名...');
    await simulateRealTyping(usernameInput, CONFIG.username);

    await new Promise(resolve => setTimeout(resolve, 100));

    log('正在输入密码...');
    await simulateRealTyping(passwordInput, CONFIG.password);

    await new Promise(resolve => setTimeout(resolve, 200));

    // 第二种页面没有运营商选择，直接点击登录

    log('正在点击登录按钮...');
    loginButton.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    log('登录请求已发送，请等待响应...');
  }

  // 为第二种登录页面添加配置按钮
  function addConfigButtonForSecondPage()
  {
    let retryCount = 0;
    const maxRetries = 10; // 最大重试次数

    function attemptToAddButton()
    {
      // 使用更宽松的选择器
      const loginButton = document.querySelector('input[name="0MKKey"][value="登录"]') as HTMLInputElement | null;
      const logoutButton = document.querySelector('input[name="logout"][value="注  销"]') as HTMLInputElement | null;

      // 确定参考按钮
      const referenceButton = loginButton || logoutButton;

      if (!referenceButton)
      {
        retryCount++;
        log(`未找到登录或注销按钮，重试中... (第 ${retryCount} 次)`);

        if (retryCount >= maxRetries)
        {
          console.error('多次尝试后仍未找到登录或注销按钮，停止添加配置按钮');
          return;
        }

        setTimeout(attemptToAddButton, 1000); // 每1秒重试一次
        return;
      }

      // 创建配置按钮，复制参考按钮的样式
      const button = document.createElement('input');
      button.type = 'button';
      button.value = '配置自动登录';

      // 复制参考按钮的所有样式
      const computedStyle = window.getComputedStyle(referenceButton);
      for (let i = 0; i < computedStyle.length; i++)
      {
        const prop = computedStyle[i];
        (button.style as any)[prop] = computedStyle.getPropertyValue(prop);
      }

      // 设置按钮位置 - 在参考按钮上方
      const parentElement = referenceButton.parentNode as HTMLElement;
      const parentRect = parentElement.getBoundingClientRect();
      const buttonRect = referenceButton.getBoundingClientRect();

      let topOffset = -50; // 默认偏移量

      button.style.position = 'absolute';
      button.style.top = `${buttonRect.top - parentRect.top - topOffset}px`;
      button.style.left = referenceButton.style.left;
      button.style.width = referenceButton.style.width;
      button.style.height = referenceButton.style.height;

      // 设置不同的背景色以区分
      button.style.backgroundColor = '#2196F3'; // 蓝色背景

      // 确保按钮置顶
      button.style.zIndex = '1000'; // 或者更高的值，确保不会被遮挡

      // 添加点击事件
      button.addEventListener('click', function ()
      {
        createConfigInterface();
      });

      // 添加到参考按钮的父元素中
      referenceButton.parentNode!.insertBefore(button, referenceButton);
      log('成功添加配置按钮');
    }

    // 初始延迟后尝试添加按钮
    setTimeout(attemptToAddButton, 500);
  }


  // 在页面加载完成后运行初始化函数
  if (document.readyState === 'loading')
  {
    document.addEventListener('DOMContentLoaded', init);
  } else
  {
    init();
  }
})();