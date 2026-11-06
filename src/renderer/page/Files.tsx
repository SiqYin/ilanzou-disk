import React, {useEffect, useState} from 'react'
import {observer} from 'mobx-react'
import {MyHeader} from '../component/Header'
import {Button, Space} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'

/**
 * 文件管理（v0.1.0）：内嵌优享版官方网页版。
 * 登录后 appToken 已注入 cookie，网页内直接是登录态；
 * 网页里可完成文件列表/上传/下载/分享等全部管理操作，
 * 客户端原生部分负责：分享链接解析、批量下载、代理等增强。
 */
const Files = observer(() => {
  const [key, setKey] = useState(1)
  const [webview, setWebview] = useState<any>(null)

  useEffect(() => {
    const el = document.getElementById('ilz-webview') as any
    if (el) setWebview(el)
  }, [key])

  return (
    <div className={'h-full flex flex-col'}>
      <MyHeader>
        <Space>
          <span>文件管理（官方网页版）</span>
          <Button
            size={'small'}
            type={'text'}
            icon={<ReloadOutlined />}
            onClick={() => {
              try {
                webview?.reload()
              } catch {
                setKey(k => k + 1)
              }
            }}
          >
            刷新
          </Button>
          <Button
            size={'small'}
            type={'text'}
            onClick={() => {
              try {
                webview?.goBack()
              } catch {
                // 无历史记录时忽略
              }
            }}
          >
            返回
          </Button>
        </Space>
      </MyHeader>
      <div className={'flex-1 overflow-hidden'}>
        <webview
          key={key}
          id={'ilz-webview'}
          src={'https://www.ilanzou.com/disk'}
          style={{height: '100%', width: '100%'}}
          allowpopups={'true' as any} /* eslint-disable-line react/no-unknown-property */
        />
      </div>
    </div>
  )
})

export default Files
