import React, {useMemo, useState} from 'react'
import {observer} from 'mobx-react'
import {shell} from '@electron/remote'
import {Button, Input, Layout, Menu, Tabs, message} from 'antd'
import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  ScissorOutlined,
  SettingOutlined,
  CloudSyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

// 早点引入样式，确保后来的样式可以覆盖之前的
import './App.less'
import './component/Icon/lib/iconfont.js'

import {download, upload} from './store'
import {MyIcon} from './component/Icon'
import pkg from '../../package.json'
import project from '../project.config'
import {Touchable} from './component/Touchable'
import Upload from './page/Upload'
import Files from './page/Files'
import Download from './page/Download'
import Complete from './page/Complete'
import Parse from './page/Parse'
import SplitMerge from './page/SplitMerge'
import Setting from './page/Setting'
import Sync from './page/Sync'
import {sync} from './store/Sync'
import {taskLength} from './utils/task'
import {config} from './store/Config'
import {linkBar} from './store/LinkBar'
import AuthWrapper from './page/AuthWrapper'

const App = observer(() => {
  const [activeKey, setActiveKey] = useState('1')
  const [webviewKey, setWebviewKey] = useState(1)
  const [barUrl, setBarUrl] = useState('')
  const [barPwd, setBarPwd] = useState('')

  const lanzouUrl = config.lanzouUrl
  const recycleUrl = useMemo(() => (lanzouUrl ? new URL(project.page.recycle, lanzouUrl).href : ''), [lanzouUrl])

  // 全局链接栏提交：切换到解析页并自动解析
  const submitLinkBar = async () => {
    let url = barUrl.trim()
    if (!url) {
      try {
        const clipboardText = await navigator.clipboard.readText()
        if (/^https?:\/\//.test(clipboardText.trim())) {
          url = clipboardText.trim()
          setBarUrl(url)
        }
      } catch {
        // 读取粘贴板失败时忽略，提示用户手动输入
      }
    }
    if (!url) {
      return message.info('请输入分享链接')
    }
    linkBar.submit(url, barPwd)
    setActiveKey('5')
  }

  return (
    <Layout>
      <Layout.Sider theme={'light'} className={'h-screen'}>
        <div className={'flex flex-col flex-1 h-full overflow-y-auto'}>
          <div style={{flex: 1}}>
            <div className='logo' style={{height: 46}} />
            <Menu
              inlineIndent={16}
              mode='inline'
              activeKey={activeKey}
              onClick={info => setActiveKey(info.key)}
              defaultSelectedKeys={[activeKey]}
              items={[
                {
                  type: 'group',
                  label: (
                    <Touchable
                      title={'去 GitHub 点亮 star'}
                      onClick={() => shell.openExternal('https://github.com/chenhb23/lanzouyun-disk')}
                    >
                      <MyIcon iconName={'github'} style={{fontSize: 14}} className={'mr-1'} /> v{pkg.version}
                    </Touchable>
                  ),
                  children: [
                    {key: '1', label: '全部文件', icon: <FolderOpenOutlined />},
                    {
                      key: '7',
                      label: (
                        <span>
                          回收站
                          {activeKey === '7' && (
                            <MyIcon
                              className='refresh'
                              iconName={'refresh'}
                              onClick={() => setWebviewKey(prevState => prevState + 1)}
                            >
                              刷新
                            </MyIcon>
                          )}
                        </span>
                      ),
                      icon: <DeleteOutlined />,
                    },
                  ],
                },
                {
                  type: 'group',
                  label: '传输列表',
                  children: [
                    {key: '9', label: `同步任务 ${taskLength(sync.list)}`, icon: <CloudSyncOutlined />},
                    {key: '2', label: `正在上传 ${taskLength(upload.list)}`, icon: <CloudUploadOutlined />},
                    {key: '3', label: `正在下载 ${taskLength(download.list)}`, icon: <CloudDownloadOutlined />},
                    {key: '4', label: `已完成`, icon: <CheckCircleOutlined />},
                  ],
                },
                {
                  type: 'group',
                  label: '实用工具',
                  children: [
                    {key: '5', label: '解析 URL', icon: <LinkOutlined />},
                    {key: '6', label: '文件分割 / 合并', icon: <ScissorOutlined />},
                  ],
                },
                {type: 'divider', style: {margin: '12px 0'}},
                {key: '8', label: '设置', icon: <SettingOutlined />},
              ]}
            />
          </div>
          <div className={'p-1'}></div>
        </div>
      </Layout.Sider>
      <Layout>
        <Layout.Header
          className={'link-bar'}
          style={{
            background: '#fff',
            padding: '0 12px',
            height: 46,
            lineHeight: '46px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <LinkOutlined style={{fontSize: 16, color: '#1890ff'}} />
          <Input
            size={'small'}
            allowClear
            value={barUrl}
            placeholder={'粘贴蓝奏云分享链接，回车立即解析（链接打不开会自动尝试其他域名）'}
            onChange={event => setBarUrl(event.target.value)}
            onPressEnter={submitLinkBar}
            style={{maxWidth: 560}}
          />
          <Input
            size={'small'}
            allowClear
            value={barPwd}
            placeholder={'密码，选填'}
            onChange={event => setBarPwd(event.target.value)}
            onPressEnter={submitLinkBar}
            style={{width: 110}}
          />
          <Button size={'small'} type={'primary'} icon={<ThunderboltOutlined />} onClick={submitLinkBar}>
            解析并下载
          </Button>
        </Layout.Header>
        <Layout.Content>
          <Tabs activeKey={activeKey} renderTabBar={() => null}>
            <Tabs.TabPane key={'1'}>
              <AuthWrapper>
                <Files />
              </AuthWrapper>
            </Tabs.TabPane>
            <Tabs.TabPane key={'2'}>
              <AuthWrapper>
                <Upload />
              </AuthWrapper>
            </Tabs.TabPane>
            <Tabs.TabPane key={'3'}>
              <Download />
            </Tabs.TabPane>
            <Tabs.TabPane key={'4'}>
              <Complete />
            </Tabs.TabPane>
            <Tabs.TabPane key={'5'}>
              <Parse />
            </Tabs.TabPane>
            <Tabs.TabPane key={'6'}>
              <SplitMerge />
            </Tabs.TabPane>
            <Tabs.TabPane key={'7'}>
              <AuthWrapper>
                <webview key={webviewKey} src={recycleUrl} style={{height: '100%'}} />
              </AuthWrapper>
            </Tabs.TabPane>
            <Tabs.TabPane key={'8'}>
              <Setting />
            </Tabs.TabPane>
            <Tabs.TabPane key={'9'}>
              <AuthWrapper>
                <Sync />
              </AuthWrapper>
            </Tabs.TabPane>
          </Tabs>
        </Layout.Content>
      </Layout>
    </Layout>
  )
})

export default App
