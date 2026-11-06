import {configure} from 'mobx'
import {create} from 'mobx-persist'
import {nativeTheme, app} from '@electron/remote'

import {Download} from './Download'
import {TaskStatus} from './AbstractTask'
import {config} from './Config'
import {DownloadTask} from './task/DownloadTask'
import {finish} from './Finish'

configure({
  enforceActions: 'never',
})

export const hydrate = create({
  storage: localStorage,
  debounce: 200,
})

export const download = new Download()
export {finish} from './Finish'

function makePause<T extends {tasks: {status: TaskStatus}[]}>(task: T) {
  task.tasks.forEach(task => {
    if (task.status === TaskStatus.pending) {
      task.status = TaskStatus.pause
    }
    return task
  })
  return task
}

hydrate('download', download, (window as any).__STATE__?.download).then(value => {
  value.list = value.list.map(item => {
    const task = makePause(item)
    return new DownloadTask(task)
  })
})

hydrate('config', config, (window as any).__STATE__?.config).then(async value => {
  if (!value.downloadDir) {
    value.downloadDir = app.getPath('downloads')
  }

  // 同步软件外观
  if (!value.themeSource) {
    value.themeSource = nativeTheme.themeSource
  } else if (value.themeSource !== nativeTheme.themeSource) {
    nativeTheme.themeSource = value.themeSource
  }
})

hydrate('finish', finish, (window as any).__STATE__?.finish).then(value => {
  value.downloadList = value.downloadList.map(item => new DownloadTask(item))
})
