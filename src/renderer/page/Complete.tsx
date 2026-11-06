import React from 'react'
import {observer} from 'mobx-react'
import {Button, Table} from 'antd'
import path from 'path'
import {shell} from '@electron/remote'

import {MyScrollView} from '../component/ScrollView'
import {MyBar} from '../component/Bar'
import {MyIcon} from '../component/Icon'
import {finish} from '../store'
import {TaskStatusName} from '../store/AbstractTask'
import SizeBox from '../component/SizeBox'

const Complete = observer(() => {
  return (
    <MyScrollView
      HeaderComponent={
        <MyBar>
          <span>已完成</span>
        </MyBar>
      }
    >
      <SizeBox>
        {size => (
          <Table
            virtual
            scroll={{x: size.width, y: size.height - 39}}
            pagination={false}
            size={'small'}
            rowKey={record => record.url + record.name}
            dataSource={finish.downloadList}
            columns={[
              {
                title: '文件名',
                render: (_, item) => {
                  const extname = path.extname(item.name || '').replace(/^\./, '')
                  return (
                    <>
                      <MyIcon iconName={extname} defaultIcon={'file'} />
                      <span>{item.name}</span>
                    </>
                  )
                },
              },
              {title: '状态', width: 100, render: () => TaskStatusName[2]},
              {
                title: '操作',
                width: 160,
                render: (_, item) => (
                  <>
                    <Button
                      size={'small'}
                      type={'text'}
                      onClick={() => shell.openPath(path.join(item.dir, item.name || ''))}
                    >
                      打开文件
                    </Button>
                    <Button size={'small'} type={'text'} onClick={() => shell.openPath(item.dir)}>
                      所在目录
                    </Button>
                  </>
                ),
              },
            ]}
          />
        )}
      </SizeBox>
    </MyScrollView>
  )
})

export default Complete
