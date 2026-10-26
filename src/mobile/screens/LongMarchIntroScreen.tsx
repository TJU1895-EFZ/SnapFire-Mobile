import { useEffect, useMemo, useState } from 'react'
import {
  INTRO_DWELL_MS,
  LONG_MARCH_INTRO,
  dwellSecondsLeft
} from '@mobile/content/longMarch'

interface Props {
  onBack: () => void
  onNext: () => void
}

/**
 * Long March introduction. The next step stays locked until the player has
 * spent the required dwell time on the page; the countdown is visible the
 * whole time so the gate never feels like a broken button.
 */
export function LongMarchIntroScreen({
  onBack,
  onNext
}: Props): React.JSX.Element {
  const [remainingMs, setRemainingMs] = useState(INTRO_DWELL_MS)

  useEffect(() => {
    let last = Date.now()
    const tick = (): void => {
      const now = Date.now()
      const delta = Math.max(0, now - last)
      last = now
      // Background time does not count as reading time.
      if (document.hidden) return
      setRemainingMs((value) => Math.max(0, value - delta))
    }
    const onVisibility = (): void => {
      last = Date.now()
    }
    const timer = window.setInterval(tick, 200)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const ready = remainingMs <= 0
  const secondsLeft = dwellSecondsLeft(remainingMs)
  const progress = useMemo(
    () =>
      Math.min(
        100,
        Math.max(0, ((INTRO_DWELL_MS - remainingMs) / INTRO_DWELL_MS) * 100)
      ),
    [remainingMs]
  )

  return (
    <div className="screen">
      <div className="screen__inner intro-inner">
        <header className="screen__header">
          <button className="ghost-button" onClick={onBack}>
            ← 返回
          </button>
          <span className="pill pill--red">导读</span>
        </header>

        <section className="long-march-hero">
          <div className="long-march-hero__years">1936 — 2026</div>
          <h1 className="long-march-hero__title">长征胜利 90 周年纪念</h1>
          <p className="long-march-hero__subtitle">
            导读 · 二万五千里，从绝境走向胜利
          </p>
        </section>

        <article className="article">
          {LONG_MARCH_INTRO.map((section) => (
            <section key={section.id} className="article__section">
              <h2 className="article__title">{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.id}-${index}`} className="article__paragraph">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </article>

        <div className="dwell-bar">
          <div className="dwell-bar__track" aria-hidden="true">
            <div className="dwell-bar__fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="dwell-bar__row">
            <div className="dwell-bar__copy" aria-live="polite">
              {ready ? (
                <>
                  <strong>导读已完成</strong>
                  <span>可以进入下一步</span>
                </>
              ) : (
                <>
                  <strong>请继续阅读，还需等待 {secondsLeft} 秒</strong>
                  <span>读完后“下一步”会自动解锁</span>
                </>
              )}
            </div>
            <button
              className="primary-button"
              disabled={!ready}
              onClick={onNext}
            >
              下一步
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
