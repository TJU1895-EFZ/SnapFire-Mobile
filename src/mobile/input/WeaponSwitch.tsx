/**
 * Weapon selector above the trigger. Tapping cycles rifle ↔ pistol and shows
 * the current fire mode; the actual view-model transition is driven by
 * BattleScene so the HUD and the 3D animation share one state change.
 */

import { WEAPONS, type WeaponId } from '@mobile/game/weapons'

interface Props {
  weapon: WeaponId
  switching: boolean
  onSwitch: () => void
  disabled?: boolean
}

export function WeaponSwitch({
  weapon,
  switching,
  onSwitch,
  disabled
}: Props): React.JSX.Element {
  const spec = WEAPONS[weapon]
  const next = weapon === 'rifle' ? WEAPONS.pistol : WEAPONS.rifle

  return (
    <button
      type="button"
      onClick={onSwitch}
      disabled={disabled || switching}
      style={{
        position: 'fixed',
        right: 'max(20px, env(safe-area-inset-right))',
        bottom: 'calc(max(20px, env(safe-area-inset-bottom)) + 88px)',
        zIndex: 500,
        minWidth: 104,
        padding: '7px 10px',
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid ${
          switching ? 'rgba(240,160,48,0.35)' : 'rgba(240,160,48,0.65)'
        }`,
        color: 'var(--text-primary)',
        opacity: disabled ? 0.35 : 1,
        touchAction: 'none',
        WebkitTapHighlightColor: 'transparent',
        pointerEvents: disabled ? 'none' : 'auto'
      }}
      aria-label={switching ? '换枪中' : `切换武器，当前${spec.name}${spec.fireModeLabel}`}
    >
      <WeaponIcon weapon={switching ? next.id : weapon} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
          {switching ? '换枪中…' : `${spec.name} · ${spec.fireModeLabel}`}
        </span>
        <span style={{ fontSize: 9, lineHeight: 1.2, opacity: 0.55 }}>
          {switching ? ' ' : `点击换${next.name}`}
        </span>
      </span>
    </button>
  )
}

function WeaponIcon({ weapon }: { weapon: WeaponId }): React.JSX.Element {
  return (
    <svg
      width="24"
      height="18"
      viewBox="0 0 24 18"
      fill="none"
      stroke="rgba(240,160,48,0.95)"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {weapon === 'rifle' ? (
        <>
          <path d="M2 8h13l3-1v-3h-4L12 7H7L4 9v3H2z" />
          <path d="M15 8l3 3h3l-1-3" />
          <path d="M9 8v4" />
          <path d="M12 8v5" />
        </>
      ) : (
        <>
          <path d="M4 5h12v4H9l-2 2H4z" />
          <path d="M8 9l-2 6h3l2-6" />
          <path d="M16 6h3" />
          <path d="M7 11h3" />
        </>
      )}
    </svg>
  )
}
