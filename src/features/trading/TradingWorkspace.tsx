import { MarketList } from './MarketList'
import { MarketHeader } from './MarketHeader'
import { TradingChart } from './TradingChart'
import { OrderBook } from './OrderBook'
import { RecentTrades } from './RecentTrades'
import { OrderEntry } from './OrderEntry'
import { BottomPanel } from '../orders/BottomPanel'
import type { Market } from '../../types/market'
import type { Theme } from '../../lib/theme'
import type { PaperTrading } from './usePaperTrading'

interface TradingWorkspaceProps {
  userId: string
  market: Market
  theme: Theme
  onSelectSymbol: (symbol: string) => void
  paper: PaperTrading
}

export function TradingWorkspace({ userId, market, theme, onSelectSymbol, paper }: TradingWorkspaceProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <MarketList userId={userId} selectedSymbol={market.symbol} onSelect={onSelectSymbol} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MarketHeader market={market} />

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <TradingChart market={market} theme={theme} />
            <BottomPanel paper={paper} />
          </div>

          <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-edge bg-panel">
            <OrderEntry market={market} paper={paper} />
            <OrderBook market={market} />
            <RecentTrades market={market} />
          </aside>
        </div>
      </div>
    </div>
  )
}
