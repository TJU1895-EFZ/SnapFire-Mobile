import type { ReactNode } from 'react'

interface Props {
  tag: string
  title: string
  subtitle: string
  description: string
  state?: 'ready' | 'planned'
  featured?: boolean
  tone?: 'accent' | 'red' | 'blue'
  icon?: ReactNode
  onClick: () => void
}

/**
 * Shared entry card for the mode menus. Planned modes stay tappable so the
 * screen can explain that they are not available yet instead of silently
 * doing nothing.
 */
export function ModeCard({
  tag,
  title,
  subtitle,
  description,
  state = 'ready',
  featured = false,
  tone = 'accent',
  icon,
  onClick
}: Props): React.JSX.Element {
  const classes = [
    'mode-card',
    `mode-card--${tone}`,
    featured ? 'mode-card--featured' : '',
    state === 'planned' ? 'mode-card--planned' : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type="button" className={classes} onClick={onClick}>
      <span className="mode-card__top">
        <span className="mode-card__tag">{icon ?? tag}</span>
        <span className={`mode-card__badge mode-card__badge--${state}`}>
          {state === 'ready' ? '可进入' : '待开发'}
        </span>
      </span>
      <span className="mode-card__title">{title}</span>
      <span className="mode-card__subtitle">{subtitle}</span>
      <span className="mode-card__desc">{description}</span>
    </button>
  )
}
