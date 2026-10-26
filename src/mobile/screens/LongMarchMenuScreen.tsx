import { ModeCard } from '@mobile/components/ModeCard'

interface Props {
  onBack: () => void
  onCombat: () => void
  onScenes: () => void
}

export function LongMarchMenuScreen({
  onBack,
  onCombat,
  onScenes
}: Props): React.JSX.Element {
  return (
    <div className="screen">
      <div className="screen__inner">
        <header className="screen__header">
          <button className="ghost-button" onClick={onBack}>
            ← 返回
          </button>
          <span className="pill pill--red">长征胜利 90 周年</span>
        </header>

        <section className="long-march-hero long-march-hero--compact">
          <div className="long-march-hero__years">1936 — 2026</div>
          <h1 className="long-march-hero__title">长征胜利 90 周年纪念</h1>
          <p className="long-march-hero__subtitle">
            选择常规对抗，或回望长征中的著名战役
          </p>
        </section>

        <div className="mode-grid mode-grid--single">
          <ModeCard
            tag="战"
            title="常规"
            subtitle="STANDARD · 红军 vs 国民党军"
            description="选择阵营并加入局域网房间，屏幕中会按阵营显示军服"
            state="ready"
            tone="red"
            onClick={onCombat}
          />
          <ModeCard
            tag="史"
            title="历史场景"
            subtitle="HISTORICAL SCENES"
            description="湘江、赤水、大渡河、泸定桥……长征著名战役一览"
            state="ready"
            tone="red"
            onClick={onScenes}
          />
        </div>

        <div className="notice notice--warning">
          历史场景目前为资料展示，战斗场景将在后续版本开放。
        </div>
      </div>
    </div>
  )
}
