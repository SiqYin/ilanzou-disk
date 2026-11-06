import React, {useState} from 'react'
import {observer} from 'mobx-react'
import {shell} from '@electron/remote'
import {Button, Input, Layout, Menu, Tabs, message} from 'antd'
import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  FileOutlined,
  LinkOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

// 早点引入样式，确保后来的样式可以覆盖之前的
import './App.less'
import './component/Icon/lib/iconfont.js'

import {download} from './store'
import {MyIcon} from './component/Icon'
import Complete from './page/Complete'
import pkg from '../../package.json'
import {Touchable} from './component/Touchable'
import Files from './page/Files'
import Download from './page/Download'
import Parse from './page/Parse'
import Setting from './page/Setting'
import {taskLength} from './utils/task'
import {linkBar} from './store/LinkBar'
import AuthWrapper from './page/AuthWrapper'

const App = observer(() => {
  const [activeKey, setActiveKey] = useState('1')
  const [barUrl, setBarUrl] = useState('')
  const [barPwd, setBarPwd] = useState('')

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
      return message.info('请输入优享版分享链接（https://www.ilanzou.com/s/...）')
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
                      onClick={() => shell.openExternal('https://github.com/SiqYin/ilanzou-disk')}
                    >
                      <MyIcon iconName={'github'} style={{fontSize: 14}} className={'mr-1'} /> v{pkg.version}
                    </Touchable>
                  ),
                  children: [{key: '1', label: '我的网盘', icon: <FileOutlined />}],
                },
                {
                  type: 'group',
                  label: '传输列表',
                  children: [
                    {key: '3', label: `正在下载 ${taskLength(download.list)}`, icon: <CloudDownloadOutlined />},
                    {key: '4', label: '已完成', icon: <CheckCircleOutlined />},
                  ],
                },
                {
                  type: 'group',
                  label: '实用工具',
                  children: [{key: '5', label: '解析分享链接', icon: <LinkOutlined />}],
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
            placeholder={'粘贴优享版分享链接（ilanzou.com/s/...），回车立即解析；链接打不开会自动重试'}
            onChange={event => setBarUrl(event.target.value)}
            onPressEnter={submitLinkBar}
            style={{maxWidth: 560}}
          />
          <Input
            size={'small'}
            allowClear
            value={barPwd}
            placeholder={'提取码，选填'}
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
            <Tabs.TabPane key={'3'}>
              <Download />
            </Tabs.TabPane>
            <Tabs.TabPane key={'4'}>
              <Complete />
            </Tabs.TabPane>
            <Tabs.TabPane key={'5'}>
              <Parse />
            </Tabs.TabPane>
            <Tabs.TabPane key={'8'}>
              <Setting />
            </Tabs.TabPane>
          </Tabs>
        </Layout.Content>
      </Layout>
    </Layout>
  )
})

export default App
