import React from 'react'
import {Button, Form, Input, InputNumber, Radio, Space, Typography} from 'antd'
import {observer} from 'mobx-react'
import {dialog, nativeTheme, shell} from '@electron/remote'

import {MyScrollView} from '../component/ScrollView'
import {config} from '../store/Config'
import pkg from '../../../package.json'

const Setting = observer(() => {
  return (
    <MyScrollView className={'pt-[60px] pl-[30px]'}>
      <Form labelAlign={'left'} colon={false} labelCol={{flex: '110px', style: {fontWeight: 'bold'}}}>
        <Form.Item label={'版本信息'} style={{marginBottom: 30}}>
          <Space direction={'vertical'}>
            <Typography.Text>当前版本: v{pkg.version}（蓝奏云优享版第三方客户端）</Typography.Text>
            <Typography.Text type={'secondary'}>项目地址: github.com/SiqYin/ilanzou-disk</Typography.Text>
          </Space>
        </Form.Item>
        <Form.Item label={'外观'}>
          <Radio.Group
            defaultValue={config.themeSource}
            onChange={async e => {
              const theme = e.target.value
              if (nativeTheme.themeSource !== theme) {
                nativeTheme.themeSource = theme
              }
              config.themeSource = nativeTheme.themeSource
            }}
          >
            <Radio.Button value={'light'}>浅色</Radio.Button>
            <Radio.Button value={'dark'}>深色</Radio.Button>
            <Radio.Button value={'system'}>跟随系统</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item label={'下载位置'} wrapperCol={{flex: '400px'}}>
          <Space direction={'vertical'} style={{width: '100%'}}>
            <Input value={config.downloadDir} readOnly />
            <Space>
              <Button
                onClick={async () => {
                  const result = await dialog.showOpenDialog({properties: ['openDirectory']})
                  if (!result.canceled && result.filePaths.length) {
                    config.downloadDir = result.filePaths[0]
                  }
                }}
              >
                更改
              </Button>
              <Button onClick={() => shell.openPath(config.downloadDir)}>打开</Button>
            </Space>
          </Space>
        </Form.Item>
        <Form.Item label={'网络代理'} wrapperCol={{flex: '400px'}}>
          <Space direction={'vertical'} style={{width: '100%'}}>
            <Input
              allowClear
              placeholder={'http://127.0.0.1:7890，留空跟随系统'}
              value={config.proxy}
              onChange={event => (config.proxy = event.target.value.trim())}
            />
            <Typography.Text type={'secondary'}>
              海外用户建议填写本地 HTTP 代理地址（如 Clash 的 http://127.0.0.1:7890），分享链接解析、下载都会走此代理
            </Typography.Text>
          </Space>
        </Form.Item>
        <Form.Item label={'同时下载数'}>
          <InputNumber
            keyboard
            min={1}
            max={5}
            value={config.downloadMax}
            onChange={value => (config.downloadMax = value)}
          />
        </Form.Item>
      </Form>
    </MyScrollView>
  )
})

export default Setting
