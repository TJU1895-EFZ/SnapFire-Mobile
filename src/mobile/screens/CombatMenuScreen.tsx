import { ModeCard } from '@mobile/components/ModeCard'

interface Props {
  onBack: () => void
  onTeam: () => void
  onPlaceholder: (mode: string) => void
}

const MODES = [
  {
    id: 'solo',
    tag: '单',
    title: '单人',
    subtitle: 'SOLO',
    description: '独自完成训练与挑战',
    ready: false
  },
  {
    id: 'team',
    tag: '团',
    title: '团战',
    subtitle: 'TEAM BATTLE',
    description: '与队友协同作战，进入巷战或野战',
    ready: true
  },
  {
    id: 'ctf',
    tag: '旗',
    title: '夺旗',
    subtitle: 'CAPTURE THE FLAG',
    description: '夺取并护送旗帜返回己方阵地',
    ready: false
  },
  {
    id: 'bomb',
    tag: '弹',
    title: '拆弹',
    subtitle: 'DEFUSE',
    description: '进攻布防或拆除炸弹',
    ready: false
  }
] as const

export function CombatMenuScreen({
  onBack,
  onTeam,
  onPlaceholder
}: Props): React.JSX.Element {
  return (
    <div className="screen">
      <div className="screen__inner">
        <header className="screen__header">
          <button className="ghost-button" onClick={onBack}>
            ← 返回
          </button>
          <span className="pill pill--warning">常规作战</span>
        </header>

        <div>
          <h2 className="screen__heading">常规作战</h2>
          <p className="tiny muted">选择一种作战方式</p>
        </div>

        <div className="mode-grid">
          {MODES.map((mode) => (
            <ModeCard
              key={mode.id}
              tag={mode.tag}
              title={mode.title}
              subtitle={mode.subtitle}
              description={mode.description}
              state={mode.ready ? 'ready' : 'planned'}
              onClick={() => {
                if (mode.id === 'team') onTeam()
                else onPlaceholder(mode.title)
              }}
            />
          ))}
        </div>

        <div className="notice notice--info">
          目前只有“团战 → 巷战”已接入局域网房间，其余模式将陆续开放。
        </div>
      </div>
    </div>
  )
}
