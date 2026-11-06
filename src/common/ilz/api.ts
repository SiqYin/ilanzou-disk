import got from 'got'
import {message} from 'antd'

import {encryptHex} from './crypto'
import {config} from '../../renderer/store/Config'

/**
 * 蓝奏云优享版 API 客户端。
 * 逆向自官方网页端（Vue SPA + axios）：
 * - API base: https://apis.ilanzou.com
 * - 公共 query: devType / devModel / uuid / extra / timestamp(AES 签名)
 * - 登录态: 请求头 appToken（token 失效时响应 code=-2）
 * - 响应约定: code=200 成功
 */

export const API_BASE = 'https://apis.ilanzou.com'

const base = got.extend({
  headers: {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    origin: 'https://www.ilanzou.com',
    referer: 'https://www.ilanzou.com/',
  },
  hooks: {
    beforeRequest: [
      options => {
        // 公共参数注入（axios 拦截器的等价实现）
        const params = new URLSearchParams(String(options.url.search || ''))
        params.set('devType', '6')
        params.set('devModel', 'Chrome')
        params.set('uuid', config.uuid)
        params.set('extra', '2')
        params.set('timestamp', encryptHex(String(Date.now())))
        if (config.token) {
          options.headers['appToken'] = config.token
        }
        const base = options.url.toString().split('?')[0]
        options.url = new URL(base + '?' + params.toString())
      },
    ],
    afterResponse: [
      async response => {
        const contentType = response.headers['content-type'] || ''
        if (!contentType.includes('application/json')) {
          return response
        }
        try {
          const body = JSON.parse(response.body as string)
          if (body && typeof body === 'object' && 'code' in body) {
            if (body.code === -2) {
              // token 失效：清空登录态（与网页端行为一致）
              config.token = ''
              config.userInfo = null
              if (!response.request.options.context?.hideMessage) {
                message.error(body.msg || '登录已失效，请重新登录')
              }
            }
          }
        } catch {
          // 非 JSON 响应原样返回
        }
        return response
      },
    ],
    beforeError: [
      error => {
        if (!error.options?.context?.hideMessage) {
          message.error(error.message)
        }
        return error
      },
    ],
  },
  https: {rejectUnauthorized: false},
  timeout: {request: 30000},
})

/** 常规 JSON 接口 */
export const request = got.extend(base, {
  headers: {'content-type': 'application/json'},
})

/** 下载流（大文件，无超时限制） */
export const downloadStream = got.extend(base)

export interface ApiResult<T = any> {
  code: number
  msg: string
  data?: T
  [key: string]: any
}

/** POST JSON 并校验业务 code */
export async function post<T = any>(
  path: string,
  params: Record<string, any> = {},
  body: Record<string, any> = {},
  opts: {hideMessage?: boolean} = {}
): Promise<ApiResult<T>> {
  const resp = await request
    .post(`${API_BASE}${path}`, {
      searchParams: params as any,
      json: body,
      context: {hideMessage: opts.hideMessage},
    })
    .json<ApiResult<T>>()
  if (resp.code !== 200 && resp.code !== 0) {
    if (!opts.hideMessage) {
      message.error(resp.msg || '请求失败')
    }
    throw new Error(resp.msg || `请求失败（code ${resp.code}）`)
  }
  return resp
}

/** 优享版 API 端点（逆向自官方网页端） */
export const endpoints = {
  login: '/unproved/login',
  register: '/unproved/reg',
  msgCode: '/unproved/msgCode',
  reset: '/unproved/reset',
  shareList: '/unproved/share/list',
  downloadUrl: '/unproved/downLoad/url',
  fileRedirect: '/unproved/file/redirect',
  transfer: '/proved/file/transfer',
  transferNum: '/proved/file/transfer/num',
  folderList: '/proved/record/folder/list',
  fileReport: '/proved/file/report',
  logout: '/proved/logout',
  userInfo: '/proved/user/info/map',
}
