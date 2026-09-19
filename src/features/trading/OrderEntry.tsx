import { useEffect, useRef, useState, type FormEvent } from 'react'
import { add, dec, mul, toFixedDown } from '../../lib/decimal'
import { formatPrice, formatQuantity } from '../../lib/market/format'
import { subscribeMarket } from '../../lib/market/stream'
import { checkMinNotional, parsePrice, parseQuantity } from '../../lib/validation'
import type { Market, Ticker } from '../../types/market'
import type { OrderSide, OrderType } from '../../types/trading'
import type { PaperTrading } from './usePaperTrading'

interface OrderEntryProps {
  market: Market
  paper: PaperTrading
}

export function OrderEntry({ market, paper }: OrderEntryProps) {
  const [side, setSide] = useState<OrderSide>('buy')
  const [type, setType] = useState<OrderType>('limit')
  const [priceInput, setPriceInput] = useState('')
  const [quantityInput, setQuantityInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [ticker, setTicker] = useState<Ticker | null>(null)
  const lastPriceRef = useRef<string | null>(null)

  useEffect(() => {
    setTicker(null)
    return subscribeMarket(market.symbol, { onTicker: setTicker })
  }, [market.symbol])

  const lastPrice = ticker?.lastPrice ?? null

  useEffect(() => {
    lastPriceRef.current = lastPrice
  }, [lastPrice])

  useEffect(() => {
    setQuantityInput('')
    setError(null)
    setNotice(null)
    const reference = lastPriceRef.current
    setPriceInput(type === 'limit' && reference ? toFixedDown(reference, market.pricePrecision) : '')
  }, [market.symbol, market.pricePrecision])

  const position = paper.positions.find((item) => item.symbol === market.symbol)
  const availableCash = paper.account?.cashBalance ?? null
  const availableQuantity = position?.quantity ?? '0'

  function changeType(next: OrderType) {
    setType(next)
    setError(null)
    setNotice(null)
    if (next === 'limit' && priceInput === '' && lastPrice) {
      setPriceInput(toFixedDown(lastPrice, market.pricePrecision))
    }
  }

  function applyMax() {
    setError(null)
    if (side === 'buy') {
      const reference = type === 'limit' ? priceInput : lastPrice
      if (!reference) {
        setError('Waiting for market price.')
        return
      }
      const parsedPlain = /^\d+(\.\d+)?$/.test(reference)
      if (!parsedPlain) {
        setError('Enter a valid price first.')
        return
      }
      if (availableCash === null) {
        setError('Paper account is not loaded yet.')
        return
      }
      const quantity = toFixedDown(
        dec(availableCash).div(dec(reference).mul('1.001')),
        market.quantityPrecision,
      )
      setQuantityInput(quantity)
      return
    }
    setQuantityInput(toFixedDown(availableQuantity, market.quantityPrecision))
  }

  const parsedQuantity = quantityInput === '' ? null : parseQuantity(quantityInput, market)
  const effectivePrice = type === 'limit' ? priceInput : lastPrice
  const canEstimate =
    parsedQuantity?.ok === true &&
    effectivePrice !== null &&
    /^\d+(\.\d+)?$/.test(effectivePrice)
  const estimatedTotal = canEstimate ? mul(effectivePrice, parsedQuantity.value) : null
  const estimatedFee = estimatedTotal !== null ? mul(estimatedTotal, '0.001') : null
  const estimatedTotalWithFee = estimatedTotal !== null && estimatedFee !== null ? add(estimatedTotal, estimatedFee) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const quantityResult = parseQuantity(quantityInput, market)
    if (!quantityResult.ok) {
      setError(quantityResult.error)
      return
    }

    let price: string | null = null
    if (type === 'limit') {
      const priceResult = parsePrice(priceInput, market)
      if (!priceResult.ok) {
        setError(priceResult.error)
        return
      }
      price = priceResult.value
    }

    const referencePrice = lastPrice
    if (!referencePrice) {
      setError('Waiting for market price.')
      return
    }

    const notional = checkMinNotional(price ?? referencePrice, quantityResult.value, market)
    if (!notional.ok) {
      setError(notional.error)
      return
    }

    setSubmitting(true)
    try {
      const order = await paper.place({
        symbol: market.symbol,
        side,
        type,
        price,
        quantity: quantityResult.value,
        referencePrice,
      })
      setQuantityInput('')
      setNotice(
        order.type === 'market'
          ? `${side === 'buy' ? 'Buy' : 'Sell'} ${market.baseAsset} filled at market.`
          : 'Limit order placed.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Order failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="border-b border-edge">
      <div className="grid grid-cols-2 gap-1 p-2">
        <button
          type="button"
          onClick={() => {
            setSide('buy')
            setError(null)
            setNotice(null)
          }}
          className={`h-8 rounded-pill text-caption font-semibold transition-colors ${
            side === 'buy' ? 'bg-buy text-white' : 'bg-inset text-faint hover:text-ink'
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => {
            setSide('sell')
            setError(null)
            setNotice(null)
          }}
          className={`h-8 rounded-pill text-caption font-semibold transition-colors ${
            side === 'sell' ? 'bg-sell text-white' : 'bg-inset text-faint hover:text-ink'
          }`}
        >
          Sell
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-2 pb-2">
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-pill bg-inset p-0.5">
          <button
            type="button"
            onClick={() => changeType('limit')}
            className={`h-6 rounded-pill text-micro font-medium ${
              type === 'limit' ? 'bg-panel text-ink shadow-sm' : 'text-faint hover:text-body'
            }`}
          >
            Limit
          </button>
          <button
            type="button"
            onClick={() => changeType('market')}
            className={`h-6 rounded-pill text-micro font-medium ${
              type === 'market' ? 'bg-panel text-ink shadow-sm' : 'text-faint hover:text-body'
            }`}
          >
            Market
          </button>
        </div>

        <label className="mb-2 block">
          <span className="mb-1 flex items-center justify-between text-micro text-faint">
            <span>Price ({market.quoteAsset})</span>
          </span>
          <input
            inputMode="decimal"
            value={type === 'market' ? '' : priceInput}
            onChange={(event) => setPriceInput(event.target.value)}
            disabled={type === 'market'}
            placeholder={type === 'market' ? 'Market price' : '0.00'}
            className="h-8 w-full rounded-md border border-edge bg-canvas px-2.5 text-caption tabular-nums text-ink placeholder:text-faint focus:border-accent focus:outline-none disabled:opacity-60"
          />
        </label>

        <label className="mb-2 block">
          <span className="mb-1 flex items-center justify-between text-micro text-faint">
            <span>Amount ({market.baseAsset})</span>
            <button type="button" onClick={applyMax} className="text-link hover:underline">
              Max
            </button>
          </span>
          <input
            inputMode="decimal"
            value={quantityInput}
            onChange={(event) => setQuantityInput(event.target.value)}
            placeholder="0.00"
            className="h-8 w-full rounded-md border border-edge bg-canvas px-2.5 text-caption tabular-nums text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </label>

        <div className="mb-2 space-y-1 rounded-md bg-inset px-2.5 py-2 text-micro">
          <div className="flex items-center justify-between">
            <span className="text-faint">Available</span>
            <span className="tabular-nums text-body">
              {side === 'buy'
                ? availableCash === null
                  ? '—'
                  : `${formatPrice(availableCash, 2)} ${market.quoteAsset}`
                : `${formatQuantity(availableQuantity, market.quantityPrecision)} ${market.baseAsset}`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-faint">Est. total</span>
            <span className="tabular-nums text-body">
              {estimatedTotal !== null ? `${formatPrice(estimatedTotal, 2)} ${market.quoteAsset}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-faint">Est. fee (0.10%)</span>
            <span className="tabular-nums text-body">
              {estimatedTotalWithFee !== null && estimatedFee !== null
                ? `${formatPrice(estimatedFee, 2)} ${market.quoteAsset}`
                : '—'}
            </span>
          </div>
        </div>

        {error ? <p className="mb-2 text-micro text-sell">{error}</p> : null}
        {notice ? <p className="mb-2 text-micro text-buy">{notice}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className={`h-9 w-full rounded-pill text-caption font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
            side === 'buy' ? 'bg-buy' : 'bg-sell'
          }`}
        >
          {submitting
            ? 'Placing…'
            : `${side === 'buy' ? 'Buy' : 'Sell'} ${market.baseAsset}`}
        </button>
      </form>
    </section>
  )
}
