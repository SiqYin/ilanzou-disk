/**
 * 优享版下载流：基于 got 的重定向跟随流（带公共签名参数与可选代理）。
 * 与 Download store 的管线（pipeline + downloadProgress + response 头）兼容。
 */
import got from 'got'
import {config} from '../store/Config'

let agents: {http: any; https: any} | null = null
let cachedProxy = ''

function getAgents() {
  const proxy = config.proxy || ''
  if (!proxy) return undefined
  if (cachedProxy !== proxy) {
    // 延迟 require，避免 webpack 静态分析路径问题
    const {HttpProxyAgent, HttpsProxyAgent} = require('hpagent')
    cachedProxy = proxy
    const opts: any = {proxy, rejectUnauthorized: false}
    agents = {http: new HttpProxyAgent(opts), https: new HttpsProxyAgent(opts)}
  }
  return agents!
}

export function createIlzDownloadStream(url: string) {
  const agent = getAgents()
  const stream = got.stream(url, {
    headers: {
      'user-agent': config.userAgent,
      referer: 'https://www.ilanzou.com/',
    },
    ...(agent ? {agent} : {}),
    https: {rejectUnauthorized: false},
    throwHttpErrors: true,
  })
  return new Promise<any>((resolve, reject) => {
    stream.once('response', (response: any) => {
      if (response.headers['content-type']?.includes('text/html')) {
        reject(new Error('下载被服务端拦截（返回了网页），请稍后重试或检查网络'))
      } else {
        resolve(stream)
      }
    })
    stream.once('error', (err: Error) => reject(err.message || err))
  })
}
