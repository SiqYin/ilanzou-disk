import React, {useEffect, useMemo, useState} from 'react'
import path from 'path'
import {MyScrollView} from '../component/ScrollView'
import {MyHeader} from '../component/Header'
import {lsShare, LsShareObject, URLType} from '../../common/core/ls'
import {MyBar} from '../component/Bar'
import {MyIcon} from '../component/Icon'
import {useLoading} from '../hook/useLoading'
import {download, sync} from '../store'
import {isFile} from '../../common/util'
import {Button, Checkbox, Col, Input, message, Row, Table} from 'antd'
import {CloudUploadOutlined} from '@ant-design/icons'
import {DownloadTask} from '../store/task/DownloadTask'
import {SyncTask} from '../store/task/SyncTask'
import {config} from '../store/Config'
import {linkBar} from '../store/LinkBar'
import {getDownloadDir} from './Setting'
import {SelectFolderModal} from './Files/SelectFolderModal'
import SizeBox from '../component/SizeBox'

export default function Parse() {
  const [shareFiles, setShareFiles] = useState<LsShareObject[]>([])
  const total = useMemo(() => shareFiles.reduce((prev, value) => prev + value.list.length, 0), [shareFiles])
  const list = useMemo(() => shareFiles.map(value => value.list).flat(), [shareFiles])

  const [merge, setMerge] = useState(false)

  const {loading, listener} = useLoading()
  const [urlForm, setUrlForm] = useState({url: '', pwd: ''})

  const [selectedRows, setSelectedRows] = useState<LsShareObject['list']>([])

  // 保存到网盘（转存：先下载到本地，再自动上传到网盘对应文件夹）
  const [saveFolderOpen, setSaveFolderOpen] = useState(false)
  const [saveRows, setSaveRows] = useState<LsShareObject['list']>([])

  // 如果只下载其中一部分文件，不进行合并
  useEffect(() => {
    if (selectedRows.length && merge) {
      setMerge(false)
    }
  }, [merge, selectedRows.length])

  const parse = async (form: typeof urlForm) => {
    try {
      const rows = parseForm(form)
      if (!rows.length) return

      // const value = await listener(lsShare(urlForm), 'lsShare')
      const value = await listener(Promise.all(rows.map(row => lsShare(row))), 'lsShare')
      setShareFiles(value)
      if (value.length === 1) {
        const item = value[0]

        setMerge(URLType.folder === item.type && isFile(item.name))
      } else {
        setMerge(false)
      }

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

  const openSave = (rows: LsShareObject['list']) => {
    if (!rows.length) return
    if (!config.isLogin) {
      return message.warning('保存到网盘需要先登录账号')
    }
    setSaveRows(rows)
    setSaveFolderOpen(true)
  }

  const handleSaveToDisk = async (folderId: FolderId) => {
    try {
      const dir = await getDownloadDir()
      for (const row of saveRows) {
        await sync.addTask(
          new SyncTask({
            folderId,
            trashOnFinish: false,
            download: new DownloadTask({
              name: row.name,
              url: row.url,
              pwd: row.pwd,
              dir,
            }),
          })
        )
      }
      message.success(`已添加 ${saveRows.length} 个转存任务，下载完成后会自动上传到网盘对应文件夹`)
      setSaveFolderOpen(false)
    } catch (e: any) {
      message.error(e.message)
    }
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
                  // rows={1}
                  autoSize={{minRows: 1, maxRows: 6}}
                  allowClear
                  value={urlForm.url}
                  onPressEnter={event => {
                    event.preventDefault()
                    parse(urlForm)
                  }}
                  placeholder='* https://...  可同时解析多行'
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
                  placeholder='提取密码，选填'
                />
              </Col>
              <Col>
                <Button
                  // style={{minWidth: 100}}
                  type={'primary'}
                  loading={loading['lsShare']}
                  onClick={async event => {
                    const nextForm = {...urlForm}
                    if (!nextForm.url) {
                      // 检查粘贴板是否符合 URL 格式
                      const clipboardText = await navigator.clipboard.readText()
                      if (!/https?:\/\//.test(clipboardText)) {
                        return message.info('请输入url')
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
                  <Button
                    // style={{minWidth: 100}}
                    loading={loading['download']}
                    onClick={async () => {
                      await listener(
                        download.addTasks(
                          selectedRows.map(
                            row =>
                              new DownloadTask({
                                name: row.name,
                                url: row.url,
                                pwd: row.pwd,
                                merge: false,
                              })
                          )
                        ),
                        'download'
                      )
                      message.success(`已添加 ${selectedRows.length} 项任务到下载列表`)
                      setSelectedRows([])
                    }}
                  >
                    下载 ({selectedRows.length}项)
                  </Button>
                ) : (
                  <Button
                    disabled={!total}
                    loading={loading['addShareTask']}
                    onClick={async () => {
                      await listener(
                        download.addTasks(
                          list.map(
                            row =>
                              new DownloadTask({
                                name: row.name,
                                url: row.url,
                                pwd: row.pwd,
                                merge: merge,
                              })
                          )
                        ),
                        'addShareTask'
                      )
                      message.success('下载任务添加成功')
                    }}
                  >
                    下载全部
                  </Button>
                )}
              </Col>
              <Col>
                {selectedRows.length ? (
                  <Button icon={<CloudUploadOutlined />} onClick={() => openSave(selectedRows)}>
                    保存到网盘 ({selectedRows.length}项)
                  </Button>
                ) : (
                  <Button icon={<CloudUploadOutlined />} disabled={!total} onClick={() => openSave(list)}>
                    全部保存到网盘
                  </Button>
                )}
              </Col>
            </Row>
          </MyHeader>
          <MyBar>
            <span>{shareFiles.length === 1 ? `${shareFiles[0].name}（${shareFiles[0].size}）` : '文件列表'}</span>
            <Checkbox
              disabled={!!selectedRows.length}
              checked={merge}
              onChange={event => setMerge(event.target.checked)}
            >
              自动合并
            </Checkbox>
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
            // rowKey={'url'}
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
                        // {
                        //   name: item.name,
                        //   url: item.url,
                        //   pwd: item.pwd,
                        //   merge: false,
                        // },
                        new DownloadTask({
                          name: item.name,
                          url: item.url,
                          pwd: item.pwd,
                          merge: false,
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
      <SelectFolderModal
        currentFolder={-1}
        open={saveFolderOpen}
        allowSame
        title={`保存到我的网盘${saveRows.length ? `（${saveRows.length} 项）` : ''}`}
        okTextPrefix={'保存到'}
        onCancel={() => setSaveFolderOpen(false)}
        onOk={handleSaveToDisk}
      />
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
