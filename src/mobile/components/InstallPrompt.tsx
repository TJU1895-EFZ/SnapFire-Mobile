import { useEffect, useState } from 'react'

type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'snapfire-install-dismissed'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * "Add to home screen" affordance.
 *
 * Chrome/Edge fire `beforeinstallprompt`; iOS Safari does not, so it gets a
 * short manual instruction instead.
 */
export function InstallPrompt(): React.JSX.Element | null {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      // storage unavailable — show the prompt anyway
    }

    const onPrompt = (event: Event): void => {
      event.preventDefault()
      setDeferred(event as PromptEvent)
      setVisible(true)
    }
    const onInstalled = (): void => {
      setVisible(false)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    if (isIos()) {
      setIosHint(true)
      setVisible(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = (): void => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore
    }
  }

  const install = async (): Promise<void> => {
    if (!deferred) return
    await deferred.prompt()
    try {
      await deferred.userChoice
    } catch {
      // ignore
    }
    setDeferred(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="install-banner">
      <span>
        {iosHint
          ? '安装到主屏：Safari 分享 → 添加到主屏幕'
          : '把 SnapFire 安装到主屏'}
      </span>
      {!iosHint && deferred && (
        <button onClick={() => void install()}>安装</button>
      )}
      <button className="install-banner__close" onClick={dismiss} aria-label="关闭">
        ✕
      </button>
    </div>
  )
}
