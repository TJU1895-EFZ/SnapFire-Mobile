import { ModeCard } from '@mobile/components/ModeCard'

interface Props {
  onBack: () => void
  onUrban: () => void
  onField: () => void
}

export function TeamModeScreen({
  onBack,
  onUrban,
  onField
}: Props): React.JSX.Element {
  return (
    <div className="screen">
      <div className="screen__inner">
        <header className="screen__header">
          <button className="ghost-button" onClick={onBack}>
            ← 返回
          </button>
          <span className="pill pill--warning">团战</span>
        </header>

        <div>
          <h2 className="screen__heading">团战</h2>
          <p className="tiny muted">选择作战场地</p>
        </div>

        <div className="mode-grid mode-grid--single">
          <ModeCard
            tag="巷"
            title="巷战"
            subtitle="URBAN · 3V3"
            description="现有局域网房间玩法：选队、建档、识别射击"
            state="ready"
            onClick={onUrban}
          />
          <ModeCard
            tag="野"
            title="野战"
            subtitle="FIELD · 3V3"
            description="开阔地形下的团战，地图与规则仍在开发"
            state="planned"
            onClick={onField}
          />
        </div>
      </div>
    </div>
  )
}
