import {BrowserWindow, getCurrentWindow, session} from '@electron/remote'
import {cookieJar} from '../../common/cookie'
import {config} from '../store/Config'
import project from '../../project.config'

export const login = async () => {
  let parent = getCurrentWindow()
  const bounds = parent.getBounds()
  const uag = parent.webContents.getUserAgent()

  let win = new BrowserWindow({...bounds, title: '登录'})
  parent.hide()

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

  // 官网登录页可能先返回 JS 质询页再刷新到真正的登录表单，
  // 只有页面存在登录表单（.p1）时才注入隐藏其余内容的 CSS，避免表单不存在时整页被隐藏导致白屏
  const applyHiding = async () => {
    try {
      if (!win || win.isDestroyed()) return
      const hasForm = await win.webContents.executeJavaScript("!!document.querySelector('.p1')")
      if (hasForm)
        await win.webContents.insertCSS('*{visibility:hidden}.p1{visibility:visible}.p1 *{visibility:inherit}')
    } catch {
      // 页面可能不支持执行脚本
    }
  }
  win.webContents.on('did-finish-load', applyHiding)

  // 会话中已有登录 cookie 时无需再登录
  if (await checkCookies(win.webContents, true)) {
    return
  }

  await win.loadURL(project.rootUrl + project.page.login, {userAgent: uag}).catch(() => {})
  await applyHiding()
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
