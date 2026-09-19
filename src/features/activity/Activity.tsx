import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { dec, mul, toFixedDown } from '../../lib/decimal'
import { formatDateTime, formatPrice, formatQuantity } from '../../lib/market/format'
import { getMarket } from '../../lib/markets'
import {
  TRANSFER_ASSETS,
  addressPlaceholder,
  getTransferAsset,
  parseAddress,
} from '../../lib/networks'
import { adjustFunds, fetchTransactions, transferCrypto } from '../../lib/transactions'
import { parseFundsAmount, parseQuantity } from '../../lib/validation'
import { AddressDisplay } from '../../components/AddressDisplay'
import type { Transaction, TransactionKind } from '../../types/trading'
import type { PaperTrading } from '../trading/usePaperTrading'
import { useTickers } from '../trading/useTickers'

interface ActivityProps {
  paper: PaperTrading
}

function TransactionTypeBadge({ kind }: { kind: TransactionKind }) {
  const tone = kind === 'deposit' ? 'bg-buy/15 text-buy' : 'bg-sell/15 text-sell'
  return (
    <span className={`rounded-pill px-1.5 py-0.5 text-micro font-medium capitalize ${tone}`}>{kind}</span>
  )
}

function networkLabel(transaction: Transaction): string {
  if (transaction.network === null) return '—'
  const asset = TRANSFER_ASSETS.find((item) => item.symbol === transaction.asset)
  return asset?.networks.find((network) => network.id === transaction.network)?.label ?? transaction.network
}

function assetPrecision(asset: string): number {
  if (asset === 'USDT') return 2
  return getMarket(`${asset}USDT`)?.quantityPrecision ?? 8
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
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const transferAsset = asset === 'USDT' ? undefined : getTransferAsset(asset)
  const market = transferAsset ? getMarket(transferAsset.marketSymbol) : undefined
  const network =
    transferAsset?.networks.find((item) => item.id === networkId) ?? transferAsset?.networks[0]
  const tickers = useTickers(transferAsset ? [transferAsset.marketSymbol] : [])
  const lastPrice = transferAsset ? (tickers[transferAsset.marketSymbol]?.lastPrice ?? null) : null
  const position = paper.positions.find((item) => item.symbol === transferAsset?.marketSymbol)
  const cash = paper.account?.cashBalance ?? null
  const available = transferAsset ? (position?.quantity ?? '0') : (cash ?? '0')

  const load = useCallback(async () => {
    try {
      setTransactions(await fetchTransactions())
      setLoadError(null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Failed to load transactions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function changeKind(next: TransactionKind) {
    setKind(next)
    setFormError(null)
    setNotice(null)
  }

  function changeAsset(next: string) {
    setAsset(next)
    const nextAsset = next === 'USDT' ? undefined : getTransferAsset(next)
    setNetworkId(nextAsset?.networks[0]?.id ?? '')
    setAddress('')
    setAddressEditing(false)
    setAmount('')
    setFormError(null)
    setNotice(null)
  }

  function applyMax() {
    if (kind !== 'withdraw' || available === '0') return
    const precision = transferAsset ? (market?.quantityPrecision ?? 8) : 2
    setAmount(toFixedDown(available, precision))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setNotice(null)

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
        setNotice(
          `${transaction.kind === 'deposit' ? 'Deposited' : 'Withdrew'} ${formatPrice(transaction.amount, 2)} USDT.`,
        )
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-edge bg-panel px-4 py-3">
        <h2 className="text-heading font-semibold tracking-tight text-ink">Activity</h2>
        <p className="mt-0.5 text-micro text-faint">
          Paper funds · USDT cash and simulated crypto transfers
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-card border border-edge bg-panel p-4">
          <p className="text-micro uppercase tracking-wide text-faint">Cash balance</p>
          <p className="mt-1 text-heading-lg font-semibold tabular-nums text-ink">
            {cash !== null ? `${formatPrice(cash, 2)} USDT` : '—'}
          </p>
          <p className="mt-2 text-micro text-faint">
            Simulated funds. Transfers never touch a real blockchain and no keys are ever entered.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="col-span-2 rounded-card border border-edge bg-panel p-4">
          <div className="mb-3 grid w-64 grid-cols-2 gap-1 rounded-pill bg-inset p-0.5">
            <button
              type="button"
              onClick={() => changeKind('deposit')}
              className={`h-6 rounded-pill text-micro font-medium ${
                kind === 'deposit' ? 'bg-panel text-ink shadow-sm' : 'text-faint hover:text-body'
              }`}
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => changeKind('withdraw')}
              className={`h-6 rounded-pill text-micro font-medium ${
                kind === 'withdraw' ? 'bg-panel text-ink shadow-sm' : 'text-faint hover:text-body'
              }`}
            >
              Withdraw
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-36">
              <span className="mb-1 block text-micro text-faint">Asset</span>
              <select
                value={asset}
                onChange={(event) => changeAsset(event.target.value)}
                className="h-8 w-full rounded-md border border-edge bg-canvas px-2 text-caption text-ink focus:border-accent focus:outline-none"
              >
                <option value="USDT">USDT (cash)</option>
                {TRANSFER_ASSETS.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol}
                  </option>
                ))}
              </select>
            </label>

            {transferAsset && network ? (
              <label className="block w-52">
                <span className="mb-1 block text-micro text-faint">Network</span>
                <select
                  value={network.id}
                  onChange={(event) => {
                    setNetworkId(event.target.value)
                    setAddress('')
                    setAddressEditing(false)
                    setFormError(null)
                  }}
                  className="h-8 w-full rounded-md border border-edge bg-canvas px-2 text-caption text-ink focus:border-accent focus:outline-none"
                >
                  {transferAsset.networks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {transferAsset && network ? (
              <div className="min-w-60 flex-1">
                <span className="mb-1 block text-micro text-faint">
                  {kind === 'deposit' ? 'From address' : 'Destination address'}
                </span>
                {addressEditing || address.trim() === '' ? (
                  <input
                    autoFocus={addressEditing}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    onBlur={() => {
                      if (address.trim() !== '') setAddressEditing(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        if (address.trim() !== '') setAddressEditing(false)
                      }
                    }}
                    onFocus={(event) => {
                      const end = event.currentTarget.value.length
                      event.currentTarget.setSelectionRange(end, end)
                    }}
                    aria-label={kind === 'deposit' ? 'From address' : 'Destination address'}
                    spellCheck={false}
                    placeholder={addressPlaceholder(network.family)}
                    className="h-8 w-full rounded-md border border-edge bg-canvas px-2.5 font-mono text-caption text-ink placeholder:font-sans placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddressEditing(true)}
                    title="Click to edit address"
                    className="flex h-8 w-full items-center rounded-md border border-edge bg-canvas px-2.5 text-left font-mono text-caption hover:border-accent focus:border-accent focus:outline-none"
                  >
                    <AddressDisplay value={address} />
                  </button>
                )}
              </div>
            ) : null}

            <label className="block w-40">
              <span className="mb-1 flex items-center justify-between text-micro text-faint">
                <span>{transferAsset ? `Quantity (${asset})` : 'Amount (USDT)'}</span>
                {kind === 'withdraw' && available !== '0' ? (
                  <button type="button" onClick={applyMax} className="text-link hover:underline">
                    Max
                  </button>
                ) : null}
              </span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="h-8 w-full rounded-md border border-edge bg-canvas px-2.5 text-caption tabular-nums text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className={`h-8 rounded-pill px-4 text-caption font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
                kind === 'deposit' ? 'bg-buy' : 'bg-sell'
              }`}
            >
              {submitting ? 'Working…' : kind === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-micro text-faint">
            <span>
              Available:{' '}
              <span className="tabular-nums text-body">
                {transferAsset
                  ? `${formatQuantity(available, market?.quantityPrecision ?? 8)} ${asset}`
                  : cash !== null
                    ? `${formatPrice(cash, 2)} USDT`
                    : '—'}
              </span>
            </span>
            {transferAsset && kind === 'deposit' && lastPrice !== null ? (
              <span>
                Cost basis:{' '}
                <span className="tabular-nums text-body">
                  {formatPrice(lastPrice, market?.pricePrecision ?? 2)} USDT
                </span>
              </span>
            ) : null}
            {transferAsset && estimatedValue !== null ? (
              <span>
                Est. value: <span className="tabular-nums text-body">{formatPrice(estimatedValue, 2)} USDT</span>
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-micro text-warn">
            Public addresses only. Never enter a private key or seed phrase.
          </p>
          {formError ? <p className="mt-2 text-micro text-sell">{formError}</p> : null}
          {notice ? <p className="mt-2 text-micro text-buy">{notice}</p> : null}
        </form>
      </div>

      {paper.error ? (
        <p className="mx-4 mb-3 rounded-card border border-sell/40 bg-sell/10 px-3 py-2 text-caption text-sell">
          {paper.error}
        </p>
      ) : null}

      <div className="mx-4 mb-4 min-h-0 flex-1 overflow-hidden rounded-card border border-edge bg-panel">
        <div className="flex h-9 items-center justify-between border-b border-edge px-4">
          <span className="text-caption font-semibold text-ink">Transaction history</span>
          <span className="text-micro text-faint">{transactions.length} records</span>
        </div>

        {loadError ? <p className="px-4 py-3 text-caption text-sell">{loadError}</p> : null}

        {!loadError && transactions.length === 0 ? (
          <p className="px-4 py-10 text-center text-caption text-faint">
            {loading ? 'Loading transactions…' : 'No transactions yet. Deposit paper funds to get started.'}
          </p>
        ) : null}

        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-caption">
              <thead className="text-micro uppercase tracking-wide text-faint">
                <tr className="border-b border-hairline">
                  <th className="px-4 py-2 text-left font-medium">Time</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Asset</th>
                  <th className="px-4 py-2 text-left font-medium">Network</th>
                  <th className="px-4 py-2 text-left font-medium">Address</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-right font-medium">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-hairline hover:bg-inset">
                    <td className="whitespace-nowrap px-4 py-2 text-faint">
                      {formatDateTime(transaction.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <TransactionTypeBadge kind={transaction.kind} />
                    </td>
                    <td className="px-4 py-2 font-medium text-ink">{transaction.asset}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-body">{networkLabel(transaction)}</td>
                    <td className="max-w-56 px-4 py-2">
                      <AddressDisplay value={transaction.address} className="text-micro" />
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${
                        transaction.kind === 'deposit' ? 'text-buy' : 'text-sell'
                      }`}
                    >
                      {transaction.kind === 'deposit' ? '+' : '-'}
                      {formatQuantity(transaction.amount, assetPrecision(transaction.asset))}{' '}
                      {transaction.asset}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-body">
                      {formatQuantity(transaction.balanceAfter, assetPrecision(transaction.asset))}{' '}
                      {transaction.asset}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
