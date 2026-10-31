import * as cheerio from 'cheerio'

import * as http from '../http'
import {config} from '../../renderer/store/Config'

/**
 * 蓝奏云分享链接的域名会不定期轮换（lanzou.com / lanzouw.com / lanzoux.com ...），
 * 海外网络环境下部分域名可能无法访问或被劫持。
 * 链接打不开时按候选列表自动切换 base 域名重试（保留子域名和路径），
 * 成功使用的域名会被记住，下次解析时优先尝试，提高打开速度。
 */
export const SHARE_BASE_DOMAINS = [
  'lanzou.com',
  'lanzouw.com',
  'lanzoux.com',
  'lanzoue.com',
  'lanzouf.com',
  'lanzouh.com',
  'lanzouk.com',
  'lanzouo.com',
  'lanzoul.com',
  'lanzouu.com',
  'lanzouy.com',
  'lanzn.com',
  'lanzous.com',
  'lanzoui.com',
]

/** 把分享链接的 base 域名替换为指定域名（保留子域名、路径和参数） */
export function swapShareDomain(url: string, baseDomain: string) {
  const parsed = new URL(url)
  const hostParts = parsed.hostname.split('.')
  const sub = hostParts.slice(0, -2).join('.')
  parsed.hostname = sub ? `${sub}.${baseDomain}` : baseDomain
  return parsed.toString()
}

/** 取链接的 base 域名，如 https://wws.lanzou.com/xxx -> lanzou.com */
export function getShareBaseDomain(url: string) {
  return new URL(url).hostname.split('.').slice(-2).join('.')
}

/**
 * 生成分享链接的域名候选列表：
 * 原链接域名 → 上次成功使用的域名 → 其余候选域名（去重）
 */
export function shareDomainCandidates(url: string): string[] {
  const candidates = [getShareBaseDomain(url)]
  if (config.lastShareDomain && !candidates.includes(config.lastShareDomain)) {
    candidates.push(config.lastShareDomain)
  }
  for (const domain of SHARE_BASE_DOMAINS) {
    if (!candidates.includes(domain)) {
      candidates.push(domain)
    }
  }
  return candidates
}

export interface SharePage {
  html: string
  url: string // 重定向后的最终地址
}

export interface PageValidateResult {
  ok: boolean
  // 不可恢复的错误（如文件已取消分享），直接抛出，不再尝试其他域名
  definitiveError?: string
}

// 明确错误标记：带此标记的异常不再换域名重试
const DEFINITIVE_KEY = '__definitive__'

export function definitiveError(message: string): Error {
  const error = new Error(message)
  ;(error as any)[DEFINITIVE_KEY] = true
  return error
}

function isDefinitiveError(e: any): boolean {
  return Boolean(e && (e as any)[DEFINITIVE_KEY])
}

/**
 * 校验分享页面内容：
 * - 命中四种分享页结构之一（文件 iframe / 密码文件 / 文件夹 / 密码文件夹）→ 有效
 * - 命中 .off 错误提示（文件已取消分享等）→ 明确错误，不再尝试其他域名
 * - 其余情况视为无效页面（可能是网络劫持、缓存污染页），换下一个域名重试
 */
export function validateSharePage(html: string): PageValidateResult {
  const $ = cheerio.load(html)
  if ($('iframe').length || $('#passwddiv').length || $('#filemore').length || $('#pwdload').length) {
    return {ok: true}
  }
  const off = $('.off').text()
  if (off) {
    return {ok: false, definitiveError: off}
  }
  return {ok: false}
}

/**
 * 抓取分享页面，网络失败或页面内容无效时自动切换候选域名重试
 * @param validate 校验页面内容是否为有效的蓝奏云分享页
 */
export async function fetchSharePage(url: string, validate: (html: string) => PageValidateResult): Promise<SharePage> {
  let lastError: any = null
  let lastMessage = ''

  for (const baseDomain of shareDomainCandidates(url)) {
    const candidateUrl = swapShareDomain(url, baseDomain)
    try {
      const instance = http.sharePage.get(candidateUrl)
      const response = await instance
      const html = await instance.text()
      const finalUrl = response.url || candidateUrl

      const result = validate(html)
      if (result.definitiveError) {
        throw definitiveError(result.definitiveError)
      }
      if (result.ok) {
        // 记录成功使用的域名，下次优先使用
        config.lastShareDomain = getShareBaseDomain(finalUrl)
        return {html, url: finalUrl}
      }
      lastMessage = '该链接返回了无效页面'
    } catch (e: any) {
      // 明确错误（文件取消共享等）不再换域名重试
      if (isDefinitiveError(e)) {
        throw e
      }
      lastError = e
    }
  }

  throw lastError || new Error(lastMessage || '分享链接无法访问')
}
