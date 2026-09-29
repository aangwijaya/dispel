import { useEffect, useRef, useState, type FormEvent } from 'react'
import { dec, mul, toFixedDown } from '../../lib/decimal'
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

const PERCENTS = [25, 50, 75, 100] as const

export function OrderEntry({ market, paper }: OrderEntryProps) {
  const [side, setSide] = useState<OrderSide>('buy')
  const [type, setType] = useState<OrderType>('limit')
  const [priceInput, setPriceInput] = useState('')
  const [quantityInput, setQuantityInput] = useState('')
  const [percent, setPercent] = useState<number | null>(null)
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
    setPercent(null)
    setError(null)
    setNotice(null)
    const reference = lastPriceRef.current
    setPriceInput(type === 'limit' && reference ? toFixedDown(reference, market.pricePrecision) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market.symbol, market.pricePrecision])

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'b' || event.key === 'B') setSide('buy')
      if (event.key === 's' || event.key === 'S') setSide('sell')
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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

  function changeSide(next: OrderSide) {
    setSide(next)
    setPercent(null)
    setError(null)
    setNotice(null)
  }

  function applyPercent(portion: number) {
    setError(null)
    setPercent(portion)
    if (side === 'buy') {
      const reference = type === 'limit' ? priceInput : lastPrice
      if (!reference) {
        setError('Waiting for market price.')
        return
      }
      if (!/^\d+(\.\d+)?$/.test(reference)) {
        setError('Enter a valid price first.')
        return
      }
      if (availableCash === null) {
        setError('Paper account is not loaded yet.')
        return
      }
      const quantity = toFixedDown(
        dec(availableCash)
          .mul(portion)
          .div(100)
          .div(dec(reference).mul('1.001')),
        market.quantityPrecision,
      )
      setQuantityInput(quantity)
      return
    }
    setQuantityInput(toFixedDown(dec(availableQuantity).mul(portion).div(100), market.quantityPrecision))
  }

  const parsedQuantity = quantityInput === '' ? null : parseQuantity(quantityInput, market)
  const effectivePrice = type === 'limit' ? priceInput : lastPrice
  const canEstimate = parsedQuantity?.ok === true && effectivePrice !== null && /^\d+(\.\d+)?$/.test(effectivePrice)
  const estimatedTotal = canEstimate ? mul(effectivePrice, parsedQuantity.value) : null
  const estimatedFee = estimatedTotal !== null ? mul(estimatedTotal, '0.001') : null

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
      setPercent(null)
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
    <section className="panel oe" aria-label="Order entry">
      <div className="bs" role="group" aria-label="Side">
        <button
          type="button"
          className="buy"
          aria-pressed={side === 'buy'}
          onClick={() => changeSide('buy')}
        >
          Buy
        </button>
        <button
          type="button"
          className="sell"
          aria-pressed={side === 'sell'}
          onClick={() => changeSide('sell')}
        >
          Sell
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="ot" role="group" aria-label="Order type">
          <button type="button" aria-pressed={type === 'market'} onClick={() => changeType('market')}>
            Market
          </button>
          <button type="button" aria-pressed={type === 'limit'} onClick={() => changeType('limit')}>
            Limit
          </button>
        </div>

        <label className="field">
          <span>
            <span>Price</span>
            <span>
              Last <b className="num" style={{ color: '#e6e6e6', fontWeight: 400 }}>{formatPrice(lastPrice, market.pricePrecision)}</b>
            </span>
          </span>
          <div className="input">
            <input
              inputMode="decimal"
              value={type === 'market' ? '' : priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              readOnly={type === 'market'}
              placeholder={type === 'market' ? 'Market price' : '0.00'}
            />
            <span className="unit">{market.quoteAsset}</span>
          </div>
        </label>

        <label className="field">
          <span>
            <span>Amount</span>
            <span>
              {side === 'buy'
                ? availableCash === null
                  ? 'Available —'
                  : `Avail ${formatPrice(availableCash, 2)}`
                : `Avail ${formatQuantity(availableQuantity, market.quantityPrecision)}`}
            </span>
          </span>
          <div className="input">
            <input
              inputMode="decimal"
              value={quantityInput}
              onChange={(event) => {
                setQuantityInput(event.target.value)
                setPercent(null)
              }}
              placeholder="0.00"
            />
            <span className="unit">{market.baseAsset}</span>
          </div>
        </label>

        <div className="pcts" role="group" aria-label="Portion of available balance">
          {PERCENTS.map((portion) => (
            <button
              key={portion}
              type="button"
              aria-pressed={percent === portion}
              onClick={() => applyPercent(portion)}
            >
              {portion === 100 ? 'Max' : `${portion}%`}
            </button>
          ))}
        </div>

        <div className="sum">
          <div>
            <span>Est. total</span>
            <b>{estimatedTotal !== null ? `${formatPrice(estimatedTotal, 2)} ${market.quoteAsset}` : '—'}</b>
          </div>
          <div>
            <span>Est. fee (0.10%)</span>
            <b>{estimatedFee !== null ? `${formatPrice(estimatedFee, 2)} ${market.quoteAsset}` : '—'}</b>
          </div>
        </div>

        {error ? <div className="err">{error}</div> : null}
        {notice ? <div className="notice">{notice}</div> : null}

        <button type="submit" className={`submit ${side}`} disabled={submitting}>
          {submitting ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${market.baseAsset}`}
        </button>
        <p className="fineprint">Paper order. Settles against simulated balances.</p>
      </form>
    </section>
  )
}
