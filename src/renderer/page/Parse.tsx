import path from 'path'
import React, {useEffect, useMemo, useState} from 'react'
import {MyScrollView} from '../component/ScrollView'
import {MyHeader} from '../component/Header'
import {lsShare, LsShareObject} from '../../common/core/ls'
import {MyBar} from '../component/Bar'
import {MyIcon} from '../component/Icon'
import {useLoading} from '../hook/useLoading'
import {download} from '../store'
import {Button, Col, Input, message, Row, Table} from 'antd'
import {DownloadTask} from '../store/task/DownloadTask'
import {linkBar} from '../store/LinkBar'
import SizeBox from '../component/SizeBox'

export default function Parse() {
  const [shareFiles, setShareFiles] = useState<LsShareObject[]>([])
  const total = useMemo(() => shareFiles.reduce((prev, value) => prev + value.list.length, 0), [shareFiles])
  const list = useMemo(() => shareFiles.map(value => value.list).flat(), [shareFiles])

  const {loading, listener} = useLoading()
  const [urlForm, setUrlForm] = useState({url: '', pwd: ''})

  const [selectedRows, setSelectedRows] = useState<LsShareObject['list']>([])

  const parse = async (form: typeof urlForm) => {
    try {
      const rows = parseForm(form)
      if (!rows.length) return

      const value = await listener(Promise.all(rows.map(row => lsShare(row))), 'lsShare')
      setShareFiles(value)
      setSelectedRows(prev => (prev.length ? [] : prev))
    } catch (e: any) {
      console.error('e', e)
      message.error(e.message)
    }
  }

  // 全局链接栏提交后自动解析
  useEffect(() => {
    if (!linkBar.url) return
    const form = {url: linkBar.url, pwd: linkBar.pwd}
    setUrlForm(form)
    parse(form)
  }, [linkBar.seq])

  const addDownload = async (rows: LsShareObject['list']) => {
    await listener(
      download.addTasks(
        rows.map(
          row =>
            new DownloadTask({
              name: row.name,
              url: row.url,
              pwd: row.pwd,
            })
        )
      ),
      'download'
    )
    message.success(`已添加 ${rows.length} 项任务到下载列表`)
    setSelectedRows([])
  }

  return (
    <MyScrollView
      scroll={false}
      HeaderComponent={
        <>
          <MyHeader>
            <Row gutter={8} wrap={false} style={{width: '100%'}}>
              <Col flex={1}>
                <Input.TextArea
                  autoSize={{minRows: 1, maxRows: 6}}
                  allowClear
                  value={urlForm.url}
                  onPressEnter={event => {
                    event.preventDefault()
                    parse(urlForm)
                  }}
                  placeholder={'* https://www.ilanzou.com/s/... 可同时解析多行'}
                  onChange={event => setUrlForm(prevState => ({...prevState, url: event.target.value}))}
                />
              </Col>
              <Col>
                <Input
                  allowClear
                  value={urlForm.pwd}
                  onPressEnter={event => {
                    event.preventDefault()
                    parse(urlForm)
                  }}
                  onChange={event => setUrlForm(prevState => ({...prevState, pwd: event.target.value}))}
                  placeholder={'提取码，选填'}
                />
              </Col>
              <Col>
                <Button
                  type={'primary'}
                  loading={loading['lsShare']}
                  onClick={async event => {
                    const nextForm = {...urlForm}
                    if (!nextForm.url) {
                      const clipboardText = await navigator.clipboard.readText()
                      if (!/https?:\/\//.test(clipboardText)) {
                        return message.info('请输入链接')
                      }
                      nextForm.url = clipboardText
                      setUrlForm(nextForm)
                    }
                    parse(nextForm)
                  }}
                >
                  {!urlForm.url ? '粘贴并解析' : '解析'}
                </Button>
              </Col>
              <Col>
                {selectedRows.length ? (
                  <Button loading={loading['download']} onClick={() => addDownload(selectedRows)}>
                    下载 ({selectedRows.length}项)
                  </Button>
                ) : (
                  <Button disabled={!total} onClick={() => addDownload(list)}>
                    下载全部
                  </Button>
                )}
              </Col>
            </Row>
          </MyHeader>
          <MyBar>
            <span>{shareFiles.length === 1 ? `${shareFiles[0].name}（${shareFiles[0].size}）` : '文件列表'}</span>
          </MyBar>
        </>
      }
    >
      <SizeBox>
        {size => (
          <Table
            virtual
            scroll={{x: size.width, y: size.height - 39}}
            sticky
            pagination={false}
            size={'small'}
            rowKey={record => record.url}
            dataSource={list}
            onRow={record => ({
              onClick: () => {
                setSelectedRows(prev =>
                  prev.some(value => value.url === record.url)
                    ? prev.filter(value => value.url !== record.url)
                    : [...prev, record]
                )
              },
            })}
            rowSelection={{
              columnWidth: 64,
              selectedRowKeys: selectedRows.map(value => value.url),
              onChange: (selectedRowKeys, selectedRows) => setSelectedRows(selectedRows),
            }}
            columns={[
              {
                title: '文件名',
                render: (_, item) => {
                  const extname = path.extname(item.name).replace(/^\./, '')
                  return (
                    <>
                      <MyIcon iconName={extname} defaultIcon={'file'} />
                      <span>{item.name}</span>
                    </>
                  )
                },
              },
              {title: '时间', width: 160, dataIndex: 'time'},
              {title: '大小', width: 160, dataIndex: 'size'},
              {
                title: '操作',
                width: 100,
                render: (_, item) => (
                  <Button
                    size={'small'}
                    type={'text'}
                    icon={<MyIcon iconName={'download'} />}
                    onClick={async event => {
                      event.stopPropagation()
                      await download.addTasks([
                        new DownloadTask({
                          name: item.name,
                          url: item.url,
                          pwd: item.pwd,
                        }),
                      ])
                      await message.success('已添加到下载列表')
                    }}
                  />
                ),
              },
            ]}
          />
        )}
      </SizeBox>
    </MyScrollView>
  )
}

function parseRow(url: string) {
  const items = url
    .split(' ')
    .map(value => value.trim())
    .filter(Boolean)
  if (!items.length) return null

  return {
    url: items.find(item => /^https?:\/\//.test(item)),
    pwd: items.find(item => /^密码[:：]/.test(item))?.replace(/^密码[:：]/, ''),
  }
}

// 解析 form 表单，url 支持输入多行
function parseForm(form: {url: string; pwd: string}) {
  const rows = form.url.split('\n').filter(Boolean).map(parseRow)
  if (!rows.length) return
  if (rows.length === 1 && !rows[0].pwd && form.pwd) {
    rows[0].pwd = form.pwd
  }
  return rows
}
