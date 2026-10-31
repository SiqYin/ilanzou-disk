import {makeAutoObservable} from 'mobx'

/**
 * 全局链接栏：任意页面输入分享链接提交后，
 * 切换到解析页并自动解析（Parse 页监听 seq 变化）
 */
class LinkBar {
  url = ''
  pwd = ''
  seq = 0

  constructor() {
    makeAutoObservable(this)
  }

  submit(url: string, pwd = '') {
    this.url = url.trim()
    this.pwd = pwd.trim()
    if (!this.url) return
    this.seq++
  }
}

export const linkBar = new LinkBar()
