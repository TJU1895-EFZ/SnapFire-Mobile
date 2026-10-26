import { LONG_MARCH_BATTLES } from '@mobile/content/longMarch'

interface Props {
  onBack: () => void
  onSelect: (name: string) => void
}

export function LongMarchBattlesScreen({
  onBack,
  onSelect
}: Props): React.JSX.Element {
  return (
    <div className="screen">
      <div className="screen__inner">
        <header className="screen__header">
          <button className="ghost-button" onClick={onBack}>
            ← 返回
          </button>
          <span className="pill pill--red">历史场景</span>
        </header>

        <div>
          <h2 className="screen__heading">长征著名战役</h2>
          <p className="tiny muted">
            从湘江血战到山城堡，每一场战斗都改变了长征的走向。
          </p>
        </div>

        <div className="battle-list">
          {LONG_MARCH_BATTLES.map((battle, index) => (
            <button
              key={battle.id}
              type="button"
              className="battle-card"
              onClick={() => onSelect(battle.name)}
            >
              <span className="battle-card__index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="battle-card__body">
                <span className="battle-card__head">
                  <strong>{battle.name}</strong>
                  <span className="pill pill--warning">场景待开发</span>
                </span>
                <span className="battle-card__meta">
                  {battle.date} · {battle.place}
                </span>
                <span className="battle-card__summary">{battle.summary}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
