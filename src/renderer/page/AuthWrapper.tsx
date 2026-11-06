import React, {PropsWithChildren, useState} from 'react'
import {observer} from 'mobx-react'
import {Button, Form, Input, message, Modal, Tabs} from 'antd'

import {session} from '@electron/remote'
import {config, IlzUserInfo} from '../store/Config'
import {MyIcon} from '../component/Icon'
import {endpoints, post} from '../../common/ilz/api'

/**
 * 蓝奏云优享版原生登录/注册：
 * - POST /unproved/login {loginName, loginPwd}
 * - 注册支持短信验证码（/unproved/msgCode + /unproved/reg）
 * 登录成功后 token 存入 Config（请求头 appToken），同时写入 cookie 供内嵌网页版使用
 */
const AuthWrapper = observer<React.FC<PropsWithChildren<any>>>(props => {
  const isLogin = config.isLogin

  const [loginOpen, setLoginOpen] = useState(false)

  if (isLogin) return props.children

  return (
    <div className={'flex flex-col h-full justify-center items-center'}>
      <MyIcon iconName={'wangpan'} className={'text-6xl'} />
      <p className={'mt-4 text-gray-500'}>登录蓝奏云优享版账号（ilanzou.com，与手机 App 同一账号）</p>
      <Button size={'large'} type={'primary'} onClick={() => setLoginOpen(true)} className={'m-5'}>
        账号登录 / 注册
        <MyIcon iconName={'submit-arrow'} className={'text-2xl -mr-1'} />
      </Button>

      <AuthModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  )
})

function AuthModal(props: {open: boolean; onClose: () => void}) {
  const [form] = Form.useForm()
  const [tab, setTab] = useState('login')
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const applyLogin = async (token: string, userInfo: IlzUserInfo | null) => {
    config.token = token
    config.userInfo = userInfo
    // 同步 appToken cookie 供内嵌网页版使用
    try {
      await session.defaultSession.cookies.set({
        url: 'https://www.ilanzou.com',
        domain: '.ilanzou.com',
        name: 'appToken',
        value: token,
      })
    } catch {
      // cookie 注入失败不影响原生 API 使用
    }
    message.success('登录成功')
    props.onClose()
  }

  const onLogin = async (values: {loginName: string; loginPwd: string}) => {
    setSubmitting(true)
    try {
      const resp: any = await post(
        endpoints.login,
        {},
        {loginName: values.loginName, loginPwd: values.loginPwd},
        {hideMessage: true}
      )
      const token = resp.data?.token || resp.token || resp.data?.appToken || ''
      if (!token) {
        message.error(resp.msg || `登录响应未包含凭证（${JSON.stringify(resp).slice(0, 80)}），请截图反馈`)
        return
      }
      await applyLogin(token, resp.data?.userInfo || resp.data || null)
    } catch (e: any) {
      message.error(e.message || '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  const onRegister = async (values: any) => {
    setSubmitting(true)
    try {
      const resp: any = await post(
        endpoints.register,
        {},
        {
          loginName: values.loginName,
          loginPwd: values.loginPwd,
          msgCode: values.msgCode,
        },
        {hideMessage: true}
      )
      const token = resp.data?.token || resp.token || ''
      if (token) {
        await applyLogin(token, resp.data?.userInfo || resp.data || null)
      } else {
        message.success(resp.msg || '注册成功，请切换到登录')
        setTab('login')
      }
    } catch (e: any) {
      message.error(e.message || '注册失败')
    } finally {
      setSubmitting(false)
    }
  }

  const sendMsgCode = async () => {
    const loginName = form.getFieldValue('loginName')
    if (!/^1\d{10}$/.test(String(loginName || ''))) {
      return message.warning('请先填写正确的手机号')
    }
    try {
      await post(endpoints.msgCode, {}, {loginName, type: 1}, {hideMessage: true})
      message.success('验证码已发送')
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (e: any) {
      message.error(e.message || '验证码发送失败')
    }
  }

  return (
    <Modal open={props.open} footer={null} width={380} title={'蓝奏云优享版'} onCancel={props.onClose} destroyOnClose>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {key: 'login', label: '登录', children: <LoginForm form={form} submitting={submitting} onFinish={onLogin} />},
          {
            key: 'reg',
            label: '注册',
            children: (
              <RegForm
                form={form}
                submitting={submitting}
                countdown={countdown}
                onSendCode={sendMsgCode}
                onFinish={onRegister}
              />
            ),
          },
        ]}
      />
    </Modal>
  )
}

function LoginForm(props: any) {
  return (
    <Form form={props.form} layout={'vertical'} onFinish={props.onFinish} requiredMark={false}>
      <Form.Item name={'loginName'} rules={[{required: true, message: '请输入手机号/账号'}]}>
        <Input size={'large'} placeholder={'手机号 / 账号'} />
      </Form.Item>
      <Form.Item name={'loginPwd'} rules={[{required: true, message: '请输入密码'}]}>
        <Input.Password size={'large'} placeholder={'密码'} />
      </Form.Item>
      <Button type={'primary'} size={'large'} block loading={props.submitting} htmlType={'submit'}>
        登录
      </Button>
    </Form>
  )
}

function RegForm(props: any) {
  return (
    <Form form={props.form} layout={'vertical'} onFinish={props.onFinish} requiredMark={false}>
      <Form.Item
        name={'loginName'}
        rules={[
          {required: true, message: '请输入手机号'},
          {pattern: /^1\d{10}$/, message: '手机号格式不正确'},
        ]}
      >
        <Input size={'large'} placeholder={'手机号'} />
      </Form.Item>
      <Form.Item name={'msgCode'} rules={[{required: true, message: '请输入短信验证码'}]}>
        <Input
          size={'large'}
          placeholder={'短信验证码'}
          addonAfter={
            <Button type={'link'} size={'small'} disabled={props.countdown > 0} onClick={props.onSendCode}>
              {props.countdown > 0 ? `${props.countdown}s` : '获取验证码'}
            </Button>
          }
        />
      </Form.Item>
      <Form.Item
        name={'loginPwd'}
        rules={[
          {required: true, message: '请输入密码'},
          {min: 6, message: '密码至少 6 位'},
        ]}
      >
        <Input.Password size={'large'} placeholder={'设置密码'} />
      </Form.Item>
      <Button type={'primary'} size={'large'} block loading={props.submitting} htmlType={'submit'}>
        注册并登录
      </Button>
    </Form>
  )
}

export default AuthWrapper
