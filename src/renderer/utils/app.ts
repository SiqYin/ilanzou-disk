import net from 'net'
import {BrowserWindow, getCurrentWindow, session} from '@electron/remote'
import {cookieJar} from '../../common/cookie'
import {config} from '../store/Config'
import project from '../../project.config'

/**
 * 覆盖官网登录页的 uselogin：
 * - 官网页面用的是 2008 年的 jQuery 1.2.6，在新内核下 show() 失效，登录失败的提示用户根本看不到，
 *   且 jquery.js 加载失败时点击按钮会直接无反应（海外网络下很常见）
 * - 这里改用 fetch 提交登录请求，并用自定义悬浮提示显示所有登录反馈
 * - ref 从页面地址动态提取：登录成功后的鉴权跳转依赖它，写错会导致登录成功却被弹回登录页
 * - 提示元素挂在 .p1 内并显式可见：登录窗口注入了隐藏 .p1 之外内容的 CSS，挂到 body 上的提示不可见
 */
const LOGIN_OVERRIDE_SCRIPT = `(() => {
  if (window.__lzLoginPatched) return 'already'
  const u = document.getElementById('username')
  const p = document.getElementById('password')
  const btn = document.getElementById('s3')
  if (!u || !p || !btn) return 'no-form'
  window.__lzLoginPatched = true

  // ref 必须与进入登录页的域名一致（页面脚本按 URL 参数模板化），鉴权跳转依赖它
  const ref =
    new URLSearchParams(location.search).get('ref') ||
    (() => {
      const m = [...document.scripts].map(s => s.textContent).join('\\n').match(/var\\s+ref\\s*=\\s*['"]([^'"]+)['"]/)
      return m && m[1]
    })() ||
    'up.woozooo.com'

  const showToast = (text, ms) => {
    let el = document.getElementById('__lz_login_msg')
    if (!el) {
      el = document.createElement('div')
      el.id = '__lz_login_msg'
      // visibility:visible!important 对抗隐藏 .p1 之外内容的注入 CSS；挂在 .p1 内双保险
      el.style.cssText =
        'position:fixed;top:20px;left:50%;transform:translateX(-50%);visibility:visible!important;' +
        'background:#fff7e6;border:1px solid #ffd591;color:#ad6800;padding:8px 16px;border-radius:6px;' +
        'font-size:14px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.15);display:none;'
      ;(document.querySelector('.p1') || document.body).appendChild(el)
    }
    el.innerText = text
    el.style.display = 'block'
    clearTimeout(el.__timer)
    el.__timer = setTimeout(() => (el.style.display = 'none'), ms || 8000)
  }

  window.uselogin = () => {
    const username = u.value
    const password = p.value
    if (!username) { showToast('请输入账户'); return false }
    if (password.length < 6) { showToast('请输入密码'); return false }
    if (btn.disabled) return false

    btn.disabled = true
    btn.value = '正在登录中...'

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)

    fetch('/accounts.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'same-origin',
      referrer: location.href,
      body:
        'task=uselogin&username=' + encodeURIComponent(username) +
        '&password=' + encodeURIComponent(password) +
        '&ref=' + encodeURIComponent(ref),
      signal: controller.signal,
    })
      .then(async r => {
        clearTimeout(timer)
        const text = await r.text()
        let msg
        try {
          msg = JSON.parse(text)
        } catch (e) {
          // 返回的不是 JSON，多为网络劫持/防护拦截页：刷新页面重新过质询（60s 内只自动重试一次）
          const last = +sessionStorage.getItem('__lzLoginRetryAt') || 0
          if (Date.now() - last > 60000) {
            sessionStorage.setItem('__lzLoginRetryAt', String(Date.now()))
            showToast('网络被拦截，正在刷新重试...', 5000)
            setTimeout(() => location.reload(), 1500)
          } else {
            btn.disabled = false
            btn.value = '登 录'
            showToast('登录失败：网络被拦截，请检查网络或在软件设置中配置代理')
          }
          return
        }
        if (msg.zt == '1') {
          btn.value = '登录成功，跳转中...'
          showToast('登录成功', 5000)
          // 跳转中转鉴权页，之后由客户端监听 cookie 变化接管
          window.location.href = msg.msgs
        } else {
          btn.disabled = false
          btn.value = '登 录'
          let tip = (msg.msgs || '登录失败，请检查账号和密码') + '（代码 ' + msg.zt + '）'
          if (String(msg.msgs || '').indexOf('用户名') >= 0 && /^1\\d{10}$/.test(username)) {
            tip += '；您的账号是手机号但被拒绝：请到官网 pc.woozooo.com 登录页试登录，确认该账号可用的登录名（部分账号需用设置的用户名而非手机号），或通过官网「找回密码」查看登录名'
          }
          showToast(tip, 15000)
        }
      })
      .catch(() => {
        clearTimeout(timer)
        btn.disabled = false
        btn.value = '登 录'
        showToast('登录失败，网络异常或超时；若反复失败请在软件设置中配置代理')
      })
    return false
  }
  return 'patched:' + ref
})()`

export const login = async () => {
  let parent = getCurrentWindow()
  const bounds = parent.getBounds()
  const uag = parent.webContents.getUserAgent()

  let win = new BrowserWindow({...bounds, title: '登录'})
  parent.hide()

  // 立即显示加载占位页，避免登录窗口初始白屏（真实登录页可能需要 1 分钟轮换重试）
  win.loadURL(LOADING_PAGE_HTML).catch(() => {})

  let winBounds = null
  win.on('moved', event => event.sender && (winBounds = event.sender.getBounds()))
  win.on('resized', event => event.sender && (winBounds = event.sender.getBounds()))
  win.on('closed', () => {
    winBounds && parent.setBounds(winBounds)
    parent.show()
  })
  win.on('closed', () => {
    parent = null
    win = null
    winBounds = null
  })

  // 检查 cookies 并更新 config
  let loginDone = false
  let cookieTimer: ReturnType<typeof setTimeout> | null = null

  // 移除挂在 session 上的登录监听
  const cleanSessionListeners = () => {
    if (cookieTimer) {
      clearTimeout(cookieTimer)
      cookieTimer = null
    }
    try {
      session.defaultSession.cookies.removeListener('changed', onCookieChanged)
    } catch {
      // 忽略移除监听的异常
    }
    try {
      win?.webContents.session.webRequest.onResponseStarted(null)
    } catch {
      // 忽略移除监听的异常
    }
  }

  const checkCookies = async (webContents: Electron.WebContents, preferUrlOrigin: boolean) => {
    if (loginDone) return true
    if (!win || win.isDestroyed()) return false
    const cookies = await webContents.session.cookies.get({})
    const cookie = cookies.find(value => value.name === 'phpdisk_info')
    if (!cookie) return false
    loginDone = true

    // ** 蓝奏云的 cookie 参数 uag 是根据登录窗口的 user-agent 来生成的，防止模拟请求，
    // ** 所以各窗口和请求工具的 user-agent 要保持一致
    const userAgent = webContents.getUserAgent()
    let url = ''
    try {
      url = webContents.getURL()
    } catch {
      // 窗口可能已销毁
    }
    let origin = ''
    try {
      origin = new URL(url).origin
    } catch {
      // 地址可能无法解析
    }
    // 登录完成后才会跳转到网盘主页（mydisk.php），跳转未完成时 origin 可能还是登录中转页的，
    // 此时回退到默认配置的地址，避免拿到错误的接口地址
    if (!preferUrlOrigin || !url.includes(project.page.home)) {
      origin = project.rootUrl
    }
    config.update({
      userAgent,
      lanzouUrl: origin,
      cookies: cookies.map(value => ({...value})),
    })
    cleanSessionListeners()
    try {
      win.close()
    } catch {
      // 窗口可能已销毁
    }
    return true
  }

  // 方式二（兜底）：登录成功后蓝奏云会设置 phpdisk_info cookie，监听 cookie 变化，
  // 防止官网调整登录后的跳转地址导致方式一监听不到
  const onCookieChanged = (_event: Electron.Event, cookie: Electron.Cookie, _cause: string, removed: boolean) => {
    if (removed || cookie.name !== 'phpdisk_info') return
    if (cookieTimer) clearTimeout(cookieTimer)
    // 跳转过程中可能连续设置多个 cookie，延迟一下等 cookie 设置完成再检查
    cookieTimer = setTimeout(() => {
      cookieTimer = null
      if (!win || win.isDestroyed()) return
      checkCookies(win.webContents, false)
    }, 1500)
  }
  session.defaultSession.cookies.on('changed', onCookieChanged)
  // 登录窗口关闭时移除 session 上的监听
  win.once('closed', cleanSessionListeners)

  // 海外优化：登录窗口的页面加载和表单提交走配置的代理。
  // 代理不可达时（如软件未启动却填了地址）自动回退直连/系统代理，避免整窗白屏
  try {
    if (config.proxy && (await isProxyAlive(config.proxy))) {
      await session.defaultSession.setProxy({proxyRules: config.proxy.replace(/^https?:\/\//, '')})
    } else {
      if (config.proxy) {
        showLoginWindowMessage(win, '配置的网络代理无法连接，本次登录已改用直连/系统代理')
      }
      // 未配置时跟随系统代理（默认行为）。不能强制 direct，否则会覆盖海外用户的系统级代理
      await session.defaultSession.setProxy({mode: 'system'})
    }
  } catch {
    // 代理设置失败时按直连继续
  }

  // 每次页面加载完成（含 JS 质挑战刷新后）注入覆盖版登录逻辑。
  // 不再注入隐藏 CSS：完整显示官网登录页，避免隐藏 CSS 在页面变化后把整窗变白
  win.webContents.on('did-finish-load', () => {
    try {
      if (!win || win.isDestroyed()) return
      win.webContents.executeJavaScript(LOGIN_OVERRIDE_SCRIPT).catch(() => {})
    } catch {
      // 窗口可能已销毁
    }
  })

  // 会话中已有登录 cookie 时无需再登录
  if (await checkCookies(win.webContents, true)) {
    return
  }

  // 登录入口域名列表：登录最终都跳转到 accounts.woozooo.com 表单页，
  // 该域名海外经常不可达。loadURL 失败时轮换入口重试，全部失败则显示明确错误页面
  const loginEntries = [project.rootUrl + project.page.login]
  for (const host of ['https://pc.woozooo.com', 'https://www.lanzou.com']) {
    if (host !== project.rootUrl) {
      loginEntries.push(host + project.page.login)
    }
  }

  // 登录后的鉴权跳转链中任何一步加载失败（accounts 域时通时断），都会表现为白屏的 chrome-error 页。
  // 这里监听导航失败：自动用入口列表重新加载，恢复期间窗口显示提示而不是死页
  let recovering = false
  win.webContents.on('did-fail-load', async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || recovering || loginDone) return
    if (!win || win.isDestroyed()) return
    // ERR_ABORTED 是页面自身 JS 跳转中断，不算失败
    if (errorCode === -3) return
    recovering = true
    console.error('登录页导航失败:', errorCode, errorDescription, validatedURL)
    try {
      showLoginWindowMessage(win, `网络异常（${describeNetError(errorCode)}），正在自动重试...`)
      for (const entry of loginEntries) {
        try {
          await win.loadURL(entry, {userAgent: uag})
          recovering = false
          return
        } catch (reason: any) {
          if (reason?.code === 'ERR_ABORTED') {
            recovering = false
            return
          }
        }
      }
      recovering = false
      await showLoginErrorPage(win, errorCode)
    } catch {
      recovering = false
    }
  })

  let loadOk = false
  for (const entry of loginEntries) {
    try {
      await win.loadURL(entry, {userAgent: uag})
      loadOk = true
      break
    } catch (reason: any) {
      // ERR_ABORTED 是页面内部 JS 跳转（如登录后的鉴权链），不算失败
      if (reason?.code === 'ERR_ABORTED') {
        loadOk = true
        break
      }
      console.error('登录页加载失败:', entry, reason?.code || reason?.message)
    }
  }

  if (!loadOk) {
    // 所有登录入口都无法访问：显示明确错误，而不是留下死窗口
    await showLoginErrorPage(win)
    return
  }
}

/** 探测代理端口是否存活（TCP 连通，3 秒超时）。只判断代理软件是否在运行 */
const isProxyAlive = async (proxy: string) => {
  try {
    const parsed = new URL(proxy.includes('://') ? proxy : 'http://' + proxy)
    const host = parsed.hostname || '127.0.0.1'
    const port = parseInt(parsed.port || '80', 10)
    return await new Promise<boolean>(resolve => {
      const socket = net.connect({host, port})
      const done = (ok: boolean) => {
        socket.destroy()
        resolve(ok)
      }
      socket.setTimeout(3000, () => done(false))
      socket.once('connect', () => done(true))
      socket.once('error', () => done(false))
    })
  } catch {
    return false
  }
}

/** 立即渲染的加载占位页（data: URL 秒开），避免登录窗口初始白屏 */
const LOADING_PAGE_HTML =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    `<body style="font-family:'Microsoft YaHei',sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
     <div style="text-align:center;color:#888;">
       <h3>正在打开登录页...</h3>
       <p style="font-size:13px;">蓝奏云登录服务器时通时断，最多需要约 1 分钟</p>
     </div></body>`
  )

/** 错误码转可读文案 */
function describeNetError(errorCode: number) {
  switch (errorCode) {
    case -105:
      return '域名解析失败'
    case -7:
      return '连接超时'
    case -100:
      return '连接被关闭'
    case -109:
      return '地址不可达'
    case -118:
      return '连接超时'
    case -130:
      return '代理连接失败'
    case -200:
      return '网络已断开'
    default:
      return `错误码 ${errorCode}`
  }
}

/** 在登录窗口顶部显示一条持久提示（不自动消失） */
function showLoginWindowMessage(win: Electron.BrowserWindow, text: string) {
  try {
    if (!win || win.isDestroyed()) return
    win.webContents
      .executeJavaScript(
        `(() => {
          let el = document.getElementById('__lz_login_msg')
          if (!el) {
            el = document.createElement('div')
            el.id = '__lz_login_msg'
            el.style.cssText = 'position:fixed;top:0;left:0;right:0;visibility:visible!important;background:#fff7e6;border-bottom:1px solid #ffd591;color:#ad6800;padding:10px 16px;font-size:14px;z-index:99999;text-align:center;'
            ;(document.body || document.documentElement).appendChild(el)
          }
          el.innerText = ${JSON.stringify(text)}
          el.style.display = 'block'
        })()`
      )
      .catch(() => {})
  } catch {
    // 窗口可能已销毁
  }
}

/** 登录入口全部失败时显示的错误说明页 */
const showLoginErrorPage = async (win: Electron.BrowserWindow, errorCode?: number) => {
  try {
    if (!win || win.isDestroyed()) return
    const reason = errorCode ? describeNetError(errorCode) : '网络无法访问'
    await win.webContents.executeJavaScript(
      `document.open(); document.write(${JSON.stringify(
        `<body style="font-family:'Microsoft YaHei',sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
         <div style="text-align:center;color:#666;max-width:520px;">
           <h2 style="color:#d46b08;">无法打开登录页（${reason}）</h2>
           <p>蓝奏云登录服务器（accounts.woozooo.com）当前无法访问，海外和国内网络都可能出现。</p>
           <p style="text-align:left;background:#f6f6f6;padding:12px;border-radius:6px;">
             解决办法：<br/>
             1. 若在「设置 → 网络代理」填写了代理地址，请确认代理软件正在运行、地址正确；<br/>
             2. 未配置代理时，打开你的代理软件的「系统代理」开关后重试；<br/>
             3. 或稍后关闭本窗口，重新点击「账号登录」。
           </p>
         </div></body>`
      )}); document.close();`
    )
  } catch {
    // 窗口可能已销毁
  }
}

export const logout = async () => {
  const cookies = await session.defaultSession.cookies.get({})
  await session.defaultSession.clearStorageData({storages: ['localstorage']})
  const cookieNames = ['phpdisk_info']
  const cookie = cookies.filter(value => cookieNames.includes(value.name))
  if (cookie.length) {
    await Promise.all(
      cookie.map(value => {
        const url = (value.secure ? 'https://' : 'http://') + value.domain.replace(/^\./, '') + value.path
        return session.defaultSession.cookies.remove(url, value.name)
      })
    )
    await cookieJar.removeAllCookies()
    config.clear()
  }
}
