import {makeObservable, observable} from 'mobx'
import path from 'path'
import fs from 'fs-extra'
import {shell} from '@electron/remote'

import {TaskStatus} from '../AbstractTask'
import {lsShare, buildShareDownloadUrl, URLType} from '../../../common/core/ls'
import {BaseTask} from './BaseTask'
import {fixFileName, isSpecificFile, restoreFileName, sizeToByte} from '../../../common/util'

export interface DownloadSubTask {
  url: string
  pwd?: string
  dir: string // 临时地址
  name: string // 真实名称
  resolve: number
  status: TaskStatus
  size: number
}

/**
 * 优享版分享下载任务：
 * - url 为分享页地址（含 fileId 的自包含链接，由 lsShare 生成）
 * - 下载直链由 buildShareDownloadUrl 现算（含时效签名）
 */
export class DownloadTask implements BaseTask {
  url: string
  urlType: URLType
  name: string
  dir: string
  pwd?: string
  merge?: boolean

  tasks: DownloadSubTask[] = []

  constructor(props: Partial<DownloadTask> = {}) {
    makeObservable(this, {
      url: observable,
      urlType: observable,
      name: observable,
      dir: observable,
      pwd: observable,
      merge: observable,
      tasks: observable,
    })
    Object.assign(this, props)
    if (props.name) {
      this.name = fixFileName(props.name)
    }
  }

  get total() {
    return this.tasks.reduce((total, item) => total + item.size, 0)
  }

  get resolve() {
    return this.tasks.reduce((total, item) => total + item.resolve, 0)
  }

  get status() {
    if (this.tasks.some(item => item.status === TaskStatus.fail)) return TaskStatus.fail
    if (this.tasks.some(item => item.status === TaskStatus.pause)) return TaskStatus.pause
    if (this.tasks.some(item => item.status === TaskStatus.pending)) return TaskStatus.pending
    if (this.tasks.length && this.tasks.every(item => item.status === TaskStatus.finish)) return TaskStatus.finish
    return TaskStatus.ready
  }

  async beforeAddTask() {
    if (this.name) {
      const name = restoreFileName(path.join(this.dir, this.name))
      if (fs.existsSync(name)) {
        const result = confirm(`"${this.name}"已存在，是否删除并重新下载？`)
        if (!result) {
          throw new Error('取消重新下载')
        }
        await shell.trashItem(name)
      }
    }
  }

  async initTask() {
    if (this.tasks?.length) return
    const {name, type, list} = await lsShare({url: this.url, pwd: this.pwd})
    if (!list?.length) return

    this.urlType = type
    if (!this.name) {
      this.name = name
    }
    if (this.urlType === URLType.file && isSpecificFile(name)) {
      this.name = restoreFileName(this.name)
    }

    const dir = path.join(this.dir, this.name) + (this.urlType === URLType.folder ? '.downloading' : '')
    this.tasks = list.map(value => {
      const name = isSpecificFile(value.name) ? restoreFileName(value.name) : value.name
      return {
        url: value.url,
        pwd: value.pwd,
        dir,
        name,
        size: sizeToByte(value.size),
        resolve: 0,
        status: TaskStatus.ready,
      }
    })
  }

  async getStream(subtask: DownloadSubTask) {
    const downloadUrl = buildShareDownloadUrl(subtask.url)
    // 动态引入避免打包层耦合；代理支持由 http 模块统一处理
    const {createIlzDownloadStream} = require('../ilzStream')
    return {
      from: await createIlzDownloadStream(downloadUrl),
      to: fs.createWriteStream(path.join(subtask.dir, subtask.name)),
    }
  }

  async finishTask() {
    const resolveTarget = path.join(this.dir, this.name)
    const subTask = this.tasks[0]
    switch (this.urlType) {
      case URLType.file:
        await fs.rename(path.join(subTask.dir, subTask.name), resolveTarget)
        break
      case URLType.folder:
        await fs.rename(subTask.dir, subTask.dir.replace(/\.downloading$/, ''))
        break
    }
  }
}
