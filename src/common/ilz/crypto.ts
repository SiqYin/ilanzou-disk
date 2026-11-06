import crypto from 'crypto'

/**
 * 蓝奏云优享版 API 签名（逆向自官方网页端）：
 * AES-128-ECB，固定密钥 lanZouY-disk-app，PKCS7 填充，输出大写 hex。
 * 用于公共参数 timestamp 及下载链接的 downloadId/auth 等参数。
 */
const KEY = Buffer.from('lanZouY-disk-app', 'utf8')

export function encryptHex(plain: string) {
  const cipher = crypto.createCipheriv('aes-128-ecb', KEY, null)
  const out = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()])
  return out.toString('hex').toUpperCase()
}

/** 生成设备标识（与网页端 localStorage.uuid 形态一致） */
export function genUuid() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < 21; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}
