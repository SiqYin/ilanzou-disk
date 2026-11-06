import {makeAutoObservable, computed} from 'mobx'
import {persist} from 'mobx-persist'
import {genUuid} from '../../common/ilz/crypto'

type BaseProps<T> = Partial<Pick<T, {[P in keyof T]: T[P] extends (...args: any) => any ? never : P}[keyof T]>>

export interface IlzUserInfo {
  userId?: number | string
  loginName?: string
  userName?: string
  [key: string]: any
}

export class Config {
  @computed get isLogin() {
    return !!this.token
  }

  @computed get isComplete() {
    return this.isLogin
  }

  // *** 登录态 ***
  @persist token = ''
  @persist('object') userInfo: IlzUserInfo | null = null

  // *** 网络配置 ***
  // 设备标识（首次生成后持久化，与网页端 localStorage.uuid 同形）
  @persist uuid = ''
  // HTTP 代理地址（如 http://127.0.0.1:7890），留空跟随系统
  @persist proxy = ''

  // *** 本地配置 ***
  @persist userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
  @persist downloadDir = ''
  @persist themeSource: Electron.NativeTheme['themeSource']
  @persist downloadMax = 2
  @persist uploadMax = 1

  constructor() {
    makeAutoObservable(this)
    if (!this.uuid) {
      this.uuid = genUuid()
    }
  }

  update(data: BaseProps<Config>) {
    data = Object.keys(data).reduce((prev, key) => (data[key] ? {...prev, [key]: data[key]} : prev), {})
    if (Object.keys(data).length) {
      Object.assign(this, data)
    }
  }

  clear() {
    this.token = ''
    this.userInfo = null
  }
}

export const config = new Config()
