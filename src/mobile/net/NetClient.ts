import { DEFAULT_PORT, type ClientMessage, type ServerMessage } from '@shared/types'

export type WelcomeMessage = Extract<ServerMessage, { type: 'welcome' }>

export type NetEvent =
  | ServerMessage
  | { type: 'socket-closed'; code: number; reason: string }
  | { type: 'socket-error'; message: string }

type Listener = (event: NetEvent) => void

export interface JoinPayload {
  roomCode: string
  playerId: string
  name: string
  hostToken?: string
}

export function normalizeHostAddress(input: string): string {
  let value = input.trim()
  if (!value) throw new Error('请输入房主电脑的地址')
  if (/^https:\/\//i.test(value)) {
    value = value.replace(/^https:\/\//i, 'wss://')
  } else if (/^http:\/\//i.test(value)) {
    value = value.replace(/^http:\/\//i, 'ws://')
  } else if (!/^wss?:\/\//i.test(value)) {
    value = `ws://${value}`
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('地址格式不正确，应类似 192.168.1.20:17890')
  }
  if (!url.hostname) throw new Error('地址格式不正确')
  if (!url.port) url.port = String(DEFAULT_PORT)
  url.pathname = ''
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

/**
 * Thin WebSocket wrapper. The server sends a `welcome` message as the join
 * acknowledgement; connect() resolves only after that arrives.
 */
export class NetClient {
  private ws: WebSocket | null = null
  private listeners = new Set<Listener>()
  private pendingResolve: ((message: WelcomeMessage) => void) | null = null
  private pendingReject: ((error: Error) => void) | null = null
  private pendingTimer: ReturnType<typeof setTimeout> | null = null
  private joined = false
  private intentionalClose = false

  get isJoined(): boolean {
    return this.joined && this.ws?.readyState === WebSocket.OPEN
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  connect(url: string, join: JoinPayload): Promise<WelcomeMessage> {
    this.closeSilently()
    this.intentionalClose = false
    this.joined = false

    return new Promise<WelcomeMessage>((resolve, reject) => {
      this.pendingResolve = resolve
      this.pendingReject = reject
      this.pendingTimer = setTimeout(() => {
        this.failPending(new Error('连接超时，请检查房主地址和局域网连接'))
        this.closeSilently()
      }, 10_000)

      let socket: WebSocket
      try {
        socket = new WebSocket(url)
      } catch (error) {
        this.failPending(
          new Error(error instanceof Error ? error.message : '无法创建网络连接')
        )
        return
      }
      this.ws = socket

      socket.onopen = () => {
        const message: ClientMessage = { type: 'join', ...join }
        socket.send(JSON.stringify(message))
      }

      socket.onmessage = (event) => {
        let message: ServerMessage
        try {
          message = JSON.parse(String(event.data)) as ServerMessage
        } catch {
          return
        }
        if (!this.joined) {
          if (message.type === 'welcome') {
            this.joined = true
            this.clearPendingTimer()
            const resolve = this.pendingResolve
            this.pendingResolve = null
            this.pendingReject = null
            this.emit(message)
            resolve?.(message)
            return
          }
          if (message.type === 'error') {
            this.failPending(new Error(message.message))
            this.emit(message)
            try {
              socket.close(4000, message.message)
            } catch {
              // ignore
            }
            return
          }
          return
        }
        this.emit(message)
      }

      socket.onerror = () => {
        if (!this.joined) {
          this.failPending(
            new Error('无法连接房主电脑，请确认地址、房间服务和防火墙设置')
          )
        } else {
          this.emit({ type: 'socket-error', message: '网络连接异常' })
        }
      }

      socket.onclose = (event) => {
        this.clearPendingTimer()
        if (!this.joined) {
          this.failPending(new Error(event.reason || '连接已关闭'))
        }
        const wasJoined = this.joined
        this.joined = false
        this.ws = null
        if (wasJoined || !this.intentionalClose) {
          this.emit({
            type: 'socket-closed',
            code: event.code,
            reason: event.reason || ''
          })
        }
      }
    })
  }

  send(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    try {
      this.ws.send(JSON.stringify(message))
      return true
    } catch {
      return false
    }
  }

  close(): void {
    this.intentionalClose = true
    this.joined = false
    this.clearPendingTimer()
    if (this.pendingReject) {
      const reject = this.pendingReject
      this.pendingResolve = null
      this.pendingReject = null
      reject(new Error('已取消连接'))
    }
    this.closeSilently()
  }

  private closeSilently(): void {
    const socket = this.ws
    this.ws = null
    this.joined = false
    this.clearPendingTimer()
    if (socket) {
      socket.onopen = null
      socket.onmessage = null
      socket.onerror = null
      socket.onclose = null
      try {
        socket.close(1000, 'client closed')
      } catch {
        // ignore
      }
    }
  }

  private clearPendingTimer(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer)
      this.pendingTimer = null
    }
  }

  private failPending(error: Error): void {
    this.clearPendingTimer()
    const reject = this.pendingReject
    this.pendingResolve = null
    this.pendingReject = null
    reject?.(error)
  }

  private emit(event: NetEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (error) {
        console.error('net listener failed', error)
      }
    }
  }
}
