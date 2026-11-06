import {post, endpoints, API_BASE} from '../ilz/api'
import {encryptHex} from '../ilz/crypto'
import {config} from '../../renderer/store/Config'

export enum URLType {
  file = 'file',
  folder = 'folder',
}

export interface LsShareItem {
  // 自包含地址：https://www.ilanzou.com/s/<shareId>?...&fileId=<id>（下载引擎按此解析）
  url: string
  name: string
  size: string
  time: string
  pwd?: string
}

export interface LsShareObject {
  name: string
  size: string
  type: URLType
  list: LsShareItem[]
}

/**
 * 优享版分享链接形如：
 *   https://www.ilanzou.com/s/<shareId>?code=<提取码>
 * 解析 = 调用 /unproved/share/list（不需要登录），列出文件。
 */
export function parseShareUrl(input: string): {shareId: string; code: string; fileId: string} {
  const url = new URL(input.trim())
  const m = url.pathname.match(/\/s\/([A-Za-z0-9]+)/)
  if (!m) {
    throw new Error('不是有效的优享版分享链接（应为 https://www.ilanzou.com/s/xxx 格式）')
  }
  return {
    shareId: m[1],
    code: url.searchParams.get('code') || '',
    fileId: url.searchParams.get('fileId') || '',
  }
}

/** 字节转可读大小 */
export function byteToSize(bytes: number) {
  if (!bytes || bytes <= 0) return '0B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)}${units[i]}`
}

/** 分享列表行（接口字段） */
interface ShareListRow {
  fileId?: number | string
  folderId?: number | string
  fileName?: string
  folderName?: string
  fileSize?: number
  createTime?: string
}

function rowToItem(row: ShareListRow, shareId: string, code: string): LsShareItem {
  const pageUrl = new URL(`https://www.ilanzou.com/s/${shareId}`)
  if (code) pageUrl.searchParams.set('code', code)
  pageUrl.searchParams.set('fileId', String(row.fileId))
  return {
    url: pageUrl.toString(),
    name: String(row.fileName || '未命名'),
    size: byteToSize(Number(row.fileSize || 0)),
    time: String(row.createTime || ''),
    pwd: code || undefined,
  }
}

/** 拉取一页分享文件列表 */
async function fetchSharePage(shareId: string, code: string, type: number, folderId: string | null, offset: number) {
  const params: Record<string, any> = {shareId, type, offset, limit: 60}
  if (code) params.code = code
  if (folderId) params.folderId = folderId
  const resp = await post(endpoints.shareList, params, {}, {hideMessage: true})
  return {
    list: (Array.isArray(resp.list) ? resp.list : []) as ShareListRow[],
    totalPage: Number(resp.totalPage || 0),
    name: String(resp.name || ''),
  }
}

/**
 * 解析分享链接。与普通版客户端的 lsShare 导出签名保持一致，供解析页和下载任务复用。
 * 文件夹分享通过 type=1 + folderId 逐层展开。
 */
export async function lsShare({url, pwd}: {url: string; pwd?: string}): Promise<LsShareObject> {
  const {shareId, code: urlCode} = parseShareUrl(url)
  const code = pwd || urlCode

  // 第一页：type=0 拿根级内容 + 分享名
  const first = await fetchSharePage(shareId, code, 0, null, 1)
  let shareName = first.name

  const items: LsShareItem[] = []
  let totalSize = 0

  const walk = async (rows: ShareListRow[], folderId: string | null) => {
    for (const row of rows) {
      if (row.folderId != null && row.fileId == null) {
        // 文件夹行：递归展开
        let offset = 1
        while (true) {
          const sub = await fetchSharePage(shareId, code, 1, String(row.folderId), offset)
          if (!shareName && sub.name) shareName = sub.name
          await walk(sub.list, String(row.folderId))
          if (offset >= sub.totalPage || !sub.list.length) break
          offset++
        }
      } else if (row.fileId != null) {
        items.push(rowToItem(row, shareId, code))
        totalSize += Number(row.fileSize || 0)
      }
    }
  }

  // 根级分页
  {
    let rows = first.list
    let offset = 1
    while (true) {
      await walk(rows, null)
      if (offset >= first.totalPage || !rows.length) break
      offset++
      const next = await fetchSharePage(shareId, code, 0, null, offset)
      rows = next.list
    }
  }

  if (!items.length) {
    throw new Error(code ? '分享内容为空或提取码错误' : '分享内容为空（可能需要提取码，请在密码框填写）')
  }

  return {
    name: shareName || `分享 ${shareId}`,
    size: byteToSize(totalSize),
    type: items.length > 1 ? URLType.folder : URLType.file,
    list: items,
  }
}

/**
 * 分享文件下载直链（逆向自官方网页端）：
 *   /unproved/file/redirect?downloadId=enc(fileId|userId)&enable=1&...&auth=enc(fileId|ms)&shareId=...
 * 返回 302 到真实文件。用 got 跟随即可下载。
 */
export function buildShareDownloadUrl(itemUrl: string) {
  const {shareId, code, fileId} = parseShareUrl(itemUrl)
  if (!fileId) {
    throw new Error('链接中缺少文件标识')
  }
  const userId = config.userInfo?.userId ?? ''
  const ms = Date.now()
  const qs = new URLSearchParams({
    downloadId: encryptHex(`${fileId}|${userId}`),
    enable: '1',
    devType: '6',
    devModel: 'Chrome',
    uuid: config.uuid,
    timestamp: encryptHex(String(ms)),
    auth: encryptHex(`${fileId}|${ms}`),
    shareId,
  })
  if (code) qs.set('code', code)
  return `${API_BASE}/unproved/file/redirect?${qs.toString()}`
}
