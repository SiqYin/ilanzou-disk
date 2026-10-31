import {Matcher} from './matcher'
import {fetchSharePage, validateSharePage} from './share-domains'
import * as http from '../http'

/**
 * 带密码的文件下载链接
 * script
 */
export async function pwdFileDownUrl(url: string, pwd: string) {
  // 抓取分享页面，打不开时自动切换蓝奏云其他域名重试
  const page = await fetchSharePage(url, validateSharePage)
  url = page.url
  const html = page.html

  const ajaxData = await Matcher.parsePwdAjax(html, pwd)

  const value = await http
    .sharePage(new URL(ajaxData.url, url), {
      method: ajaxData.type,
      headers: {referer: url},
      form: ajaxData.data,
    })
    .json<DownloadUrlRes>()

  return {
    name: value.inf,
    url: `${value.dom}/file/${value.url}`,
  }
}

/**
 * 无密码文件下载链接
 * iframe
 */
export async function fileDownUrl(url: string) {
  // 抓取分享页面，打不开时自动切换蓝奏云其他域名重试
  const page = await fetchSharePage(url, validateSharePage)
  url = page.url
  const html = page.html

  const iframe = Matcher.matchIframe(html)
  if (!iframe) {
    throw new Error('文件页面解析出错')
  }

  const iframeUrl = new URL(iframe, url).toString()
  const downHtml = await http.sharePage.get(iframeUrl).text()

  const ajaxData = await Matcher.parseAjax(downHtml)
  const value = await http
    .sharePage(new URL(ajaxData.url, url), {
      method: ajaxData.type,
      headers: {referer: iframeUrl},
      form: ajaxData.data,
    })
    .json<DownloadUrlRes>()

  return {
    name: value.inf,
    url: `${value.dom}/file/${value.url}`,
  }
}
