import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function IconBase({ children, ...props }: IconProps & { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconOverview(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </IconBase>
  )
}

export function IconCombat(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </IconBase>
  )
}

export function IconHistory(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.1-5.6" />
      <path d="M3.5 3.5V8H8" />
      <path d="M12 7.5V12l3 1.8" />
    </IconBase>
  )
}

export function IconSettings(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.7a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.7a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.3 9c.14.38.42.7.78.91.24.14.52.21.8.21H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.88Z" />
    </IconBase>
  )
}

export function IconArrowLeft(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </IconBase>
  )
}

export function IconCopy(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </IconBase>
  )
}

export function IconClose(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
  )
}

export function IconCheck(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M4 12.5l5 5L20 6.5" />
    </IconBase>
  )
}

export function IconCamera(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M4 7.5h3l1.4-2h7.2L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.6" />
    </IconBase>
  )
}

export function IconUsers(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.2" />
      <path d="M18 14.2a6.2 6.2 0 0 1 3.2 5.4" />
    </IconBase>
  )
}

export function IconLock(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.2" />
    </IconBase>
  )
}

export function IconWifi(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M3 9a15 15 0 0 1 18 0" />
      <path d="M6.5 12.5a10 10 0 0 1 11 0" />
      <path d="M10 16a5 5 0 0 1 4 0" />
      <circle cx="12" cy="19" r="0.8" fill="currentColor" />
    </IconBase>
  )
}

export function IconShield(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M12 2.5l7.5 3v6.2c0 4.6-3 8.1-7.5 9.8-4.5-1.7-7.5-5.2-7.5-9.8V5.5L12 2.5Z" />
      <path d="M8.8 12l2.2 2.2 4.4-4.6" />
    </IconBase>
  )
}

export function IconCrosshair(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

export function IconPlay(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </IconBase>
  )
}

export function IconLogout(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </IconBase>
  )
}

export function IconPlus(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  )
}

export function IconRefresh(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M20 11a8 8 0 0 0-14.9-3.6L3 10" />
      <path d="M3 4v6h6" />
      <path d="M4 13a8 8 0 0 0 14.9 3.6L21 14" />
      <path d="M21 20v-6h-6" />
    </IconBase>
  )
}

export function IconAlert(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M12 3.5l9 16H3l9-16Z" />
      <path d="M12 9v4.5" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </IconBase>
  )
}

export function IconDownload(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M12 3v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </IconBase>
  )
}

export function IconUpload(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </IconBase>
  )
}

export function IconTrash(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 13h9.4l.8-13" />
      <path d="M10 11v5M14 11v5" />
    </IconBase>
  )
}

export function IconChevronRight(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M9 5l7 7-7 7" />
    </IconBase>
  )
}

export function IconPulse(props: IconProps): React.JSX.Element {
  return (
    <IconBase {...props}>
      <path d="M2.5 12h4l2.2-6 4.2 12 2.4-6H21.5" />
    </IconBase>
  )
}

export function SnapFireMark(props: IconProps): React.JSX.Element {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M20 3 36 12v16L20 37 4 28V12L20 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.55"
      />
      <circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="20" cy="20" r="2.4" fill="currentColor" />
      <path
        d="M20 4v7M20 29v7M4 20h7M29 20h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
