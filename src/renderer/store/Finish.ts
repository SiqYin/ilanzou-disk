import {DownloadTask} from './task/DownloadTask'
import {makeAutoObservable} from 'mobx'
import {persist} from 'mobx-persist'

export class Finish {
  @persist('list') downloadList: DownloadTask[] = []

  constructor() {
    makeAutoObservable(this)
  }
}

export const finish = new Finish()
