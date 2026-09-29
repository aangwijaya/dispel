import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { dec, mul, toFixedDown } from '../../lib/decimal'
import { formatPrice, formatQuantity } from '../../lib/market/format'
import { getMarket } from '../../lib/markets'
import {
  TRANSFER_ASSETS,
  addressPlaceholder,
  getTransferAsset,
  parseAddress,
  type AddressFamily,
} from '../../lib/networks'
import { adjustFunds, fetchTransactions, transferCrypto } from '../../lib/transactions'
import { looksLikeSecret, parseFundsAmount, parseQuantity } from '../../lib/validation'
import { AddressDisplay } from '../../components/AddressDisplay'
import type { Transaction, TransactionKind } from '../../types/trading'
import type { PaperTrading } from '../trading/usePaperTrading'
import { useTickers } from '../trading/useTickers'
import heroArt from '../../assets/dispel-hero.svg'

interface ActivityProps {
  paper: PaperTrading
}

type AssetFilter = 'all' | 'cash' | 'crypto'

const FAMILY_HINT: Record<AddressFamily, string> = {
  evm: 'EVM address · 0x + 40 hex characters',
  solana: 'Solana address · base58, 32–44 characters',
  bitcoin: 'Bitcoin address · bc1…, 1… or 3…',
}

const PERCENTS = [25, 50, 75, 100] as const

function assetPrecision(asset: string): number {
  if (asset === 'USDT') return 2
  return getMarket(`${asset}USDT`)?.quantityPrecision ?? 8
}

function transactionNetworkLabel(transaction: Transaction): string {
  if (transaction.network === null) return '—'
  const asset = TRANSFER_ASSETS.find((item) => item.symbol === transaction.asset)
  return asset?.networks.find((network) => network.id === transaction.network)?.label ?? transaction.network
}

function dayInfo(iso: string): { key: string; label: string } {
  const date = new Date(iso)
  const today = new Date()
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const diffDays = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000)
  const short = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (diffDays === 0) return { key: short, label: `Today · ${short}` }
  if (diffDays === 1) return { key: short, label: `Yesterday · ${short}` }
  return { key: short, label: short }
}

function shortAddress(value: string): string {
  if (value.length <= 12) return value
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

function money(value: string | number, digits = 2): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return numeric.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function Activity({ paper }: ActivityProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [kind, setKind] = useState<TransactionKind>('deposit')
  const [asset, setAsset] = useState('USDT')
  const [networkId, setNetworkId] = useState('')
  const [address, setAddress] = useState('')
  const [addressEditing, setAddressEditing] = useState(false)
  const [guard, setGuard] = useState(false)
  const [amount, setAmount] = useState('')
  const [percent, setPercent] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [ledgerKind, setLedgerKind] = useState<'all' | TransactionKind>('all')
  const [ledgerAsset, setLedgerAsset] = useState<AssetFilter>('all')
  const formRef = useRef<HTMLFormElement | null>(null)
  const flashTimer = useRef<number | null>(null)
  const toastTimer = useRef<number | null>(null)

  const transferAsset = asset === 'USDT' ? undefined : getTransferAsset(asset)
  const market = transferAsset ? getMarket(transferAsset.marketSymbol) : undefined
  const network = transferAsset?.networks.find((item) => item.id === networkId) ?? transferAsset?.networks[0]
  const tickers = useTickers(transferAsset ? [transferAsset.marketSymbol] : [])
  const lastPrice = transferAsset ? (tickers[transferAsset.marketSymbol]?.lastPrice ?? null) : null
  const position = paper.positions.find((item) => item.symbol === transferAsset?.marketSymbol)
  const cash = paper.account?.cashBalance ?? null
  const available = transferAsset ? (position?.quantity ?? '0') : (cash ?? '0')

  const netDeposited = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.asset === 'USDT')
        .reduce(
          (total, transaction) =>
            transaction.kind === 'deposit' ? total.plus(transaction.amount) : total.minus(transaction.amount),
          dec(0),
        ),
    [transactions],
  )

  const sevenDaysAgo = Date.now() - 7 * 24 * 3_600_000
  const inCount = transactions.filter(
    (transaction) => transaction.kind === 'deposit' && new Date(transaction.createdAt).getTime() >= sevenDaysAgo,
  ).length
  const outCount = transactions.filter(
    (transaction) => transaction.kind === 'withdraw' && new Date(transaction.createdAt).getTime() >= sevenDaysAgo,
  ).length

  const reserved = paper.openOrders
    .filter((order) => order.side === 'buy' && order.limitPrice !== null)
    .reduce((total, order) => total.plus(mul(order.limitPrice ?? '0', order.quantity)), dec(0))
  const reservedCount = paper.openOrders.filter((order) => order.side === 'buy' && order.limitPrice !== null).length

  const load = useMemo(
    () => async () => {
      try {
        setTransactions(await fetchTransactions())
        setLoadError(null)
      } catch (cause) {
        setLoadError(cause instanceof Error ? cause.message : 'Failed to load transactions.')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    }
  }, [])

  function showToast(message: string) {
    setToast(message)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  function flash(transactionId: string) {
    setFlashId(transactionId)
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1600)
  }

  function changeKind(next: TransactionKind) {
    setKind(next)
    setAmount('')
    setPercent(null)
    setFormError(null)
    setNotice(null)
  }

  function changeAsset(next: string) {
    setAsset(next)
    const nextAsset = next === 'USDT' ? undefined : getTransferAsset(next)
    setNetworkId(nextAsset?.networks[0]?.id ?? '')
    setAddress('')
    setAddressEditing(false)
    setGuard(false)
    setAmount('')
    setPercent(null)
    setFormError(null)
    setNotice(null)
  }

  function changeAddress(value: string) {
    if (looksLikeSecret(value)) {
      setAddress('')
      setAddressEditing(false)
      setGuard(true)
      setFormError(null)
      return
    }
    setGuard(false)
    setAddress(value)
  }

  function clearForm() {
    setAmount('')
    setAddress('')
    setAddressEditing(false)
    setGuard(false)
    setPercent(null)
    setFormError(null)
    setNotice(null)
  }

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return
      const form = formRef.current
      if (form && document.activeElement instanceof Node && form.contains(document.activeElement)) {
        clearForm()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  function applyPercent(portion: number) {
    if (!transferAsset) {
      if (kind !== 'withdraw' || cash === null) return
      setAmount(toFixedDown(dec(cash).mul(portion).div(100), 2))
      setPercent(portion)
      return
    }
    const precision = market?.quantityPrecision ?? 8
    setAmount(toFixedDown(dec(available).mul(portion).div(100), precision))
    setPercent(portion)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setNotice(null)

    if (guard) {
      setFormError('Remove the seed phrase or private key first. Dispel only needs a public address.')
      return
    }

    if (!transferAsset) {
      const parsed = parseFundsAmount(amount)
      if (!parsed.ok) {
        setFormError(parsed.error)
        return
      }
      if (kind === 'withdraw') {
        if (cash === null) {
          setFormError('Paper account is not loaded yet.')
          return
        }
        if (dec(cash).lt(parsed.value)) {
          setFormError('Insufficient cash balance.')
          return
        }
      }

      setSubmitting(true)
      try {
        const transaction = await adjustFunds(kind, parsed.value)
        setAmount('')
        setPercent(null)
        setNotice(
          `${transaction.kind === 'deposit' ? 'Deposited' : 'Withdrew'} ${formatPrice(transaction.amount, 2)} USDT.`,
        )
        flash(transaction.id)
        await Promise.all([load(), paper.refresh()])
      } catch (cause) {
        setFormError(cause instanceof Error ? cause.message : 'Transaction failed.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!market || !network) {
      setFormError('Unsupported asset.')
      return
    }

    const parsedQuantity = parseQuantity(amount, market)
    if (!parsedQuantity.ok) {
      setFormError(parsedQuantity.error)
      return
    }

    const parsedAddress = parseAddress(address, network.family)
    if (!parsedAddress.ok) {
      setFormError(parsedAddress.error)
      setAddressEditing(true)
      return
    }

    if (kind === 'withdraw' && dec(available).lt(parsedQuantity.value)) {
      setFormError('Insufficient position quantity.')
      return
    }

    const referencePrice = kind === 'deposit' ? lastPrice : null
    if (kind === 'deposit' && referencePrice === null) {
      setFormError('Waiting for market price.')
      return
    }

    setSubmitting(true)
    try {
      const transaction = await transferCrypto({
        symbol: transferAsset.marketSymbol,
        asset: transferAsset.symbol,
        kind,
        quantity: parsedQuantity.value,
        network: network.id,
        address: parsedAddress.value,
        referencePrice,
      })
      setAmount('')
      setAddress('')
      setAddressEditing(false)
      setNotice(
        `${transaction.kind === 'deposit' ? 'Deposited' : 'Withdrew'} ${formatQuantity(
          transaction.amount,
          market.quantityPrecision,
        )} ${transaction.asset} on ${network.label}.`,
      )
      flash(transaction.id)
      await Promise.all([load(), paper.refresh()])
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Transfer failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const parsedAmount = market ? parseQuantity(amount, market) : null
  const estimatedValue =
    transferAsset && lastPrice !== null && parsedAmount?.ok === true
      ? mul(lastPrice, parsedAmount.value)
      : null
  const addressValid = transferAsset && network && address.trim() !== '' && parseAddress(address, network.family).ok
  const amountNumeric = /^\d+(\.\d+)?$/.test(amount.trim()) ? dec(amount.trim()) : null

  function reviewLine(): string | null {
    if (guard) return null
    if (amountNumeric === null || amountNumeric.lte(0)) return null
    const verb = kind === 'deposit' ? 'Deposit' : 'Withdraw'
    if (!transferAsset) {
      return `${verb} ${money(amount)} USDT ${kind === 'deposit' ? 'into' : 'from'} your paper cash`
    }
    if (!network) return null
    const quantityText = `${money(amountNumeric.toFixed(4), amountNumeric.lt(1) ? 4 : 2)} ${transferAsset.symbol}`
    if (!addressValid) {
      return `Add a valid ${network.label.split(' (')[0]} address to continue.`
    }
    return `${verb} ${quantityText} on ${network.label} ${kind === 'deposit' ? 'from' : 'to'} ${shortAddress(address.trim())}`
  }

  const line = reviewLine()
  const insufficient =
    !transferAsset && kind === 'withdraw' && cash !== null && amountNumeric !== null && amountNumeric.gt(cash)
  const cryptoInsufficient =
    Boolean(transferAsset) && kind === 'withdraw' && amountNumeric !== null && amountNumeric.gt(available)
  const ready = line !== null && !insufficient && !cryptoInsufficient
  const signedAmount = amountNumeric === null ? dec(0) : amountNumeric.mul(kind === 'deposit' ? 1 : -1)

  const filteredTransactions = transactions.filter((transaction) => {
    if (ledgerKind !== 'all' && transaction.kind !== ledgerKind) return false
    if (ledgerAsset === 'cash' && transaction.asset !== 'USDT') return false
    if (ledgerAsset === 'crypto' && transaction.asset === 'USDT') return false
    return true
  })

  const days = useMemo(() => {
    const groups = new Map<string, { label: string; rows: Transaction[] }>()
    for (const transaction of filteredTransactions) {
      const info = dayInfo(transaction.createdAt)
      const group = groups.get(info.key) ?? { label: info.label, rows: [] }
      group.rows.push(transaction)
      groups.set(info.key, group)
    }
    return [...groups.values()]
  }, [filteredTransactions])

  return (
    <>
      <div className="act-top">
        <section className="panel cash" aria-label="Paper cash">
          <img src={heroArt} alt="" aria-hidden="true" />
          <span className="eyebrow">Paper cash</span>
          <div className="big">
            {cash !== null ? money(cash) : '—'}
            <small>USDT</small>
          </div>
          <p className="sub">
            Spendable on Trade.{' '}
            {reservedCount > 0
              ? `Another ${money(reserved.toFixed(2))} is reserved by ${reservedCount} open limit order${reservedCount > 1 ? 's' : ''}.`
              : 'No cash is reserved by open orders.'}
          </p>
          <div className="tiles">
            <div>
              <div className="k">Net deposited</div>
              <div className="v">{money(netDeposited.toFixed(2))}</div>
            </div>
            <div>
              <div className="k">In · 7 days</div>
              <div className="v">{inCount} moves</div>
            </div>
            <div>
              <div className="k">Out · 7 days</div>
              <div className="v">{outCount} moves</div>
            </div>
          </div>
          <div className="sim">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="1.5" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
            </svg>
            <span>Simulated. Transfers never touch a real blockchain, and Dispel never asks for keys.</span>
          </div>
        </section>

        <section className="panel move" aria-label="Move paper funds">
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            <div className="move-h">
              <h4>Move paper funds</h4>
              <div className="dw" role="group" aria-label="Direction">
                <button type="button" aria-pressed={kind === 'deposit'} onClick={() => changeKind('deposit')}>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" />
                  </svg>
                  Deposit
                </button>
                <button type="button" aria-pressed={kind === 'withdraw'} onClick={() => changeKind('withdraw')}>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />
                  </svg>
                  Withdraw
                </button>
              </div>
            </div>

            <div className="fgrid">
              <div>
                <div className="fl">
                  <span>Asset</span>
                  <span>{transferAsset ? 'Crypto moves at the live price' : 'Cash in USDT'}</span>
                </div>
                <div className="assets" role="group" aria-label="Asset">
                  <button
                    type="button"
                    className="as"
                    aria-pressed={asset === 'USDT'}
                    onClick={() => changeAsset('USDT')}
                  >
                    <span className="ico">$</span>
                    Cash
                  </button>
                  {TRANSFER_ASSETS.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      className="as"
                      aria-pressed={asset === item.symbol}
                      onClick={() => changeAsset(item.symbol)}
                    >
                      <span className="ico">{item.symbol.slice(0, 3)}</span>
                      {item.symbol}
                    </button>
                  ))}
                </div>

                {transferAsset && network ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="fl">
                      <span>Network</span>
                    </div>
                    <div className="nets" role="group" aria-label="Network">
                      {transferAsset.networks.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="net"
                          aria-pressed={item.id === network.id}
                          onClick={() => {
                            setNetworkId(item.id)
                            setAddress('')
                            setAddressEditing(false)
                            setGuard(false)
                            setFormError(null)
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div className="fam">{FAMILY_HINT[network.family]}</div>
                  </div>
                ) : null}
              </div>

              <div>
                {transferAsset && network ? (
                  <div>
                    <div className="fl">
                      <span>{kind === 'deposit' ? 'From address' : 'Destination address'}</span>
                      <span>public address only</span>
                    </div>
                    <div className="activity-field addr">
                      {guard ? (
                        <input
                          type="text"
                          value=""
                          onChange={(event) => changeAddress(event.target.value)}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder="Cleared"
                          aria-label="Address"
                        />
                      ) : addressValid && !addressEditing ? (
                        <>
                          <button
                            type="button"
                            className="addr-view"
                            title="Click to edit address"
                            onClick={() => setAddressEditing(true)}
                          >
                            <AddressDisplay value={address} className="addr" />
                          </button>
                          <svg className="vstate" viewBox="0 0 16 16" fill="none" stroke="#59d499" strokeWidth="1.8">
                            <path d="m3.5 8.5 3 3 6-7" />
                          </svg>
                        </>
                      ) : (
                        <input
                          autoFocus={addressEditing}
                          type="text"
                          value={address}
                          onChange={(event) => changeAddress(event.target.value)}
                          onBlur={() => {
                            if (addressValid) setAddressEditing(false)
                          }}
                          spellCheck={false}
                          autoComplete="off"
                          aria-label={kind === 'deposit' ? 'From address' : 'Destination address'}
                          placeholder={addressPlaceholder(network.family)}
                        />
                      )}
                    </div>
                    {guard ? (
                      <div className="danger" role="alert">
                        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                          <path d="M8 1.5 15 14H1L8 1.5Zm-.75 4.5v4h1.5V6h-1.5Zm0 5.2v1.5h1.5v-1.5h-1.5Z" />
                        </svg>
                        <span>
                          <b>This looks like a seed phrase or private key.</b> It was cleared and not saved.
                          Dispel only needs a public address, and no one legitimate will ever ask you for this.
                        </span>
                      </div>
                    ) : addressValid && !addressEditing ? (
                      <div className="vmsg up">
                        Valid {network.label.split(' (')[0]} address. Check the first and last 4 characters.
                      </div>
                    ) : address.trim() !== '' ? (
                      <div className="vmsg down">
                        That isn't a valid {network.label.split(' (')[0]} address. Expected:{' '}
                        {FAMILY_HINT[network.family].split(' · ')[1]}.
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ marginTop: 14 }}>
                  <div className="fl">
                    <span>{transferAsset ? `Quantity (${asset})` : 'Amount (USDT)'}</span>
                  </div>
                  <div className="activity-field">
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value)
                        setPercent(null)
                      }}
                      placeholder="0.00"
                      aria-label={transferAsset ? `Quantity in ${asset}` : 'Amount in USDT'}
                    />
                    {kind === 'withdraw' && available !== '0' && !transferAsset ? (
                      <button
                        type="button"
                        className="max"
                        onClick={() => applyPercent(100)}
                        title="Use the full available balance"
                      >
                        Max
                      </button>
                    ) : null}
                    <span className="unit">{asset}</span>
                  </div>
                  <div className="avail">
                    <span>
                      Available{' '}
                      <b>
                        {transferAsset
                          ? `${formatQuantity(available, market?.quantityPrecision ?? 8)} ${asset}`
                          : cash !== null
                            ? `${formatPrice(cash, 2)} USDT`
                            : '—'}
                      </b>
                    </span>
                    {transferAsset && estimatedValue !== null ? (
                      <span>
                        ≈ <b>{formatPrice(estimatedValue, 2)} USDT</b>
                      </span>
                    ) : null}
                  </div>
                  {kind === 'withdraw' && available !== '0' ? (
                    <div className="pcts" role="group" aria-label="Portion of available balance">
                      {PERCENTS.map((portion) => (
                        <button
                          key={portion}
                          type="button"
                          aria-pressed={percent === portion}
                          onClick={() => applyPercent(portion)}
                        >
                          {portion === 100 ? 'All' : `${portion}%`}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="review">
              <div>
                <div className="line">
                  {guard ? (
                    <>Remove the flagged value above before moving funds.</>
                  ) : insufficient ? (
                    <>You have {money(cash ?? '0')} USDT. Enter a smaller amount.</>
                  ) : cryptoInsufficient ? (
                    <>You hold {formatQuantity(available, market?.quantityPrecision ?? 8)} {asset}. Enter a smaller quantity.</>
                  ) : line !== null ? (
                    line
                  ) : (
                    <>Enter {transferAsset ? 'a quantity' : 'an amount'} to review this {kind}.</>
                  )}
                </div>
                {line !== null && !guard ? (
                  <div className="facts2">
                    {transferAsset ? (
                      <>
                        <span>
                          {kind === 'deposit' ? 'Cost basis' : 'Leaves at'}{' '}
                          <b>{lastPrice !== null ? formatPrice(lastPrice, market?.pricePrecision ?? 2) : '—'}</b>
                        </span>
                        <span>
                          Value <b>{estimatedValue !== null ? `${formatPrice(estimatedValue, 2)} USDT` : '—'}</b>
                        </span>
                        <span>
                          Position after{' '}
                          <b>
                            {formatQuantity(
                              Math.max(Number(available) + Number(signedAmount.toFixed(8)), 0).toString(),
                              market?.quantityPrecision ?? 8,
                            )}{' '}
                            {asset}
                          </b>
                        </span>
                      </>
                    ) : (
                      <>
                        <span>
                          Cash after{' '}
                          <b>
                            {cash !== null ? `${money(dec(cash).plus(signedAmount).toFixed(2), 2)} USDT` : '—'}
                          </b>
                        </span>
                        <span>
                          Net deposited after <b>{money(netDeposited.plus(signedAmount).toFixed(2))}</b>
                        </span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              <button type="submit" className="btn" disabled={!ready || submitting}>
                {submitting ? 'Working…' : `${kind === 'deposit' ? 'Deposit' : 'Withdraw'}${amount ? ` ${amount} ${asset}` : ''}`}
                <kbd>↵</kbd>
              </button>
            </div>

            <div className="safety">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 1.5 15 14H1L8 1.5Zm-.75 4.5v4h1.5V6h-1.5Zm0 5.2v1.5h1.5v-1.5h-1.5Z" />
              </svg>
              <span>Public addresses only. Never enter a private key or seed phrase. Dispel will never ask for one.</span>
            </div>

            {formError ? <div className="err">{formError}</div> : null}
            {notice ? <div className="ok">{notice}</div> : null}
          </form>
        </section>
      </div>

      <section className="panel" aria-label="Ledger">
        <div className="p-head">
          <div>
            <h4>
              Ledger{' '}
              <span className="count">
                {filteredTransactions.length} of {transactions.length}
              </span>
            </h4>
            <p>Every paper deposit, withdrawal and transfer, newest first. Trades are on Portfolio.</p>
          </div>
          <div className="ledger-tools">
            <div className="seg" role="group" aria-label="Type">
              {(['all', 'deposit', 'withdraw'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={ledgerKind === value} onClick={() => setLedgerKind(value)}>
                  {value === 'all' ? 'All' : value === 'deposit' ? 'In' : 'Out'}
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Asset">
              {(['all', 'cash', 'crypto'] as AssetFilter[]).map((value) => (
                <button key={value} type="button" aria-pressed={ledgerAsset === value} onClick={() => setLedgerAsset(value)}>
                  {value === 'all' ? 'All assets' : value === 'cash' ? 'Cash' : 'Crypto'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadError ? <p className="err" style={{ margin: '0 8px 8px' }}>{loadError}</p> : null}
        {!loadError && transactions.length === 0 ? (
          <p className="book-state" style={{ padding: '24px 12px', textAlign: 'center' }}>
            {loading ? 'Loading transactions…' : 'No transactions yet. Deposit paper funds to get started.'}
          </p>
        ) : null}
        {transactions.length > 0 && filteredTransactions.length === 0 ? (
          <div className="empty-note" style={{ margin: '8px 2px' }}>
            Nothing matches these filters.
          </div>
        ) : null}

        <div className="ledger">
          {days.map((day) => {
            const net = day.rows
              .filter((transaction) => transaction.asset === 'USDT')
              .reduce(
                (total, transaction) =>
                  transaction.kind === 'deposit' ? total.plus(transaction.amount) : total.minus(transaction.amount),
                dec(0),
              )
            const hasCash = day.rows.some((transaction) => transaction.asset === 'USDT')
            return (
              <div key={day.label}>
                <div className="day">
                  <b>{day.label}</b>
                  {hasCash ? <span>net {net.gte(0) ? '+' : '−'}{money(net.abs().toFixed(2))} USDT</span> : <span>—</span>}
                </div>
                {day.rows.map((transaction) => {
                  const crypto = transaction.asset !== 'USDT'
                  const precision = assetPrecision(transaction.asset)
                  const deposit = transaction.kind === 'deposit'
                  return (
                    <div key={transaction.id} className={`tx ${flashId === transaction.id ? 'new' : ''}`}>
                      <span className="dir">
                        <span className="ico">{transaction.asset.slice(0, 3)}</span>
                        <span className="arr">
                          <svg viewBox="0 0 12 12" fill="none" stroke={deposit ? '#e6e6e6' : '#9c9c9d'} strokeWidth="2">
                            <path d={deposit ? 'M6 2v8M2.5 6.5 6 10l3.5-3.5' : 'M6 10V2M2.5 5.5 6 2l3.5 3.5'} />
                          </svg>
                        </span>
                      </span>
                      <span className="t">
                        <b>
                          {deposit ? 'Deposited' : 'Withdrew'} {formatQuantity(transaction.amount, precision)}{' '}
                          {transaction.asset}
                        </b>
                        <small className="mono">
                          {new Date(transaction.createdAt).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          UTC
                        </small>
                      </span>
                      <span className="where">
                        {crypto ? (
                          <>
                            {transactionNetworkLabel(transaction)} · {deposit ? 'from' : 'to'}{' '}
                            <AddressDisplay value={transaction.address} className="addr" />
                          </>
                        ) : (
                          <>
                            Paper cash
                            <small>USDT · simulated</small>
                          </>
                        )}
                      </span>
                      <span className="amt">
                        <b style={{ color: deposit ? 'var(--mist)' : 'var(--ash)' }}>
                          {deposit ? '+' : '−'}
                          {formatQuantity(transaction.amount, precision)} {transaction.asset}
                        </b>
                      </span>
                      <span className="after">
                        {crypto && transaction.address ? (
                          <button
                            type="button"
                            className="copy"
                            onClick={() => {
                              const value = transaction.address ?? ''
                              navigator.clipboard?.writeText(value).then(
                                () => showToast('Address copied'),
                                () => showToast(value),
                              )
                            }}
                          >
                            Copy address
                          </button>
                        ) : null}
                        <b>
                          {formatQuantity(transaction.balanceAfter, precision)} {transaction.asset}
                        </b>
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  )
}
