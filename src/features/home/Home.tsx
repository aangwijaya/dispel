import type { PaperTrading } from '../trading/usePaperTrading'

interface HomeProps {
  userId: string
  selectedSymbol: string
  paper: PaperTrading
  onOpenChart: (symbol: string) => void
  onOpenPortfolio: () => void
  onOpenActivity: () => void
}

export function Home(_props: HomeProps) {
  return (
    <section className="panel">
      <div className="p-head">
        <div>
          <h3>Market read</h3>
          <p>Loading the market read…</p>
        </div>
      </div>
    </section>
  )
}
