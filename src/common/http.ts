import got from 'got'
import {message} from 'antd'
import is from 'electron-is'
import {HttpProxyAgent, HttpsProxyAgent} from 'hpagent'

import {cookieJar, shareCookieJar} from './cookie'
import {delay} from './util'
import {config} from '../renderer/store/Config'
import {logout} from '../renderer/utils/app'

/**
 * 海外网络优化：读取用户配置的 HTTP 代理（为空时回退到环境变量），
 * 分享链接解析、下载、转存等所有请求都会走该代理
 */
let cachedAgents: {http: any; https: any} | null = null
let cachedProxy = ''

function getProxyAgents(): {http: any; https: any} | undefined {
  const proxy =
    config.proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    ''
  if (!proxy) {
    cachedAgents = null
    cachedProxy = ''
    return undefined
  }
  if (cachedProxy !== proxy) {
    cachedProxy = proxy
    cachedAgents = {
      http: new HttpProxyAgent({proxy, rejectUnauthorized: false}),
      https: new HttpsProxyAgent({proxy, rejectUnauthorized: false}),
    }
  }
  return cachedAgents!
}

const base = got.extend({
  headers: {
    'accept-language': 'zh-CN,zh;q=0.9,zh-TW;q=0.8',
    pragma: 'no-cache',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    // referer: 'https://up.woozooo.com/mydisk.php?item=files&action=index&u=1702063',
  },
  hooks: {
    init: [
      (_, self) => {
        self.headers['user-agent'] = config.userAgent
      },
    ],
    beforeRequest: [
      options => {
        options.agent = getProxyAgents() as any
      },
    ],
    afterResponse: [
      async response => {
        // 返回值状态判断。 蓝奏云返回类型: text/json，github 返回类型: application/json
        if (response.headers['content-type']?.includes('text/json')) {
          const body = JSON.parse(response.body as string)
          switch (body.zt) {
            // 1,2 成功
            case 1:
            case 2:
              return response
            case 9:
              message.error('登录信息失效，请重新登录')
              await delay()
              await logout()
              return response
            default:
              throw new Error(typeof body.info === 'string' ? body.info : body.text)
          }
        }
        return response
      },
    ],
    beforeError: [
      error => {
        // todo: 记录
        console.log('error, url:', error.options.url.toString())
        console.error(error)
        if (!error.options?.context?.hideMessage) {
          message.error(error.message)
        }
        return error
      },
    ],
  },
  https: {rejectUnauthorized: false},
  ...(is.dev()
    ? {
        // // 开发用
        // agent: {
        //   https: new (require('hpagent').HttpsProxyAgent)({
        //     keepAlive: true,
        //     // keepAliveMsecs: 1000,
        //     // maxSockets: 256,
        //     // maxFreeSockets: 256,
        //     // scheduling: 'lifo',
        //     rejectUnauthorized: false,
        //     proxy: 'http://127.0.0.1:8888',
        //   }),
        // },
      }
    : {}),
})

export const request = got.extend(base, {
  cookieJar,
  hooks: {
    init: [
      (_, self) => {
        if (!self.prefixUrl) {
          self.prefixUrl = config.lanzouUrl
        }
      },
    ],
    beforeRequest: [
      options => {
        if (config.referer && (!options.headers['referer'] || !options.headers['Referer'])) {
          const url = typeof options.url === 'string' ? new URL(options.url) : options.url
          if (url.origin === new URL(config.referer).origin) {
            options.headers['referer'] = config.referer
          }
        }
      },
    ],
  },
})

export const share = got.extend(base, {
  cookieJar: shareCookieJar,
  ignoreInvalidCookies: true,
})

/**
 * 分享页面 / 分享接口专用：带请求超时。
 * 海外网络下部分域名可能长时间无响应，不设超时会一直挂起；
 * 下载大文件的流式请求仍使用 share（无超时）。
 */
export const sharePage = got.extend(share, {
  timeout: {request: 30000},
})
