interface AddressDisplayProps {
  value: string | null | undefined
  className?: string
}

export function AddressDisplay({ value, className }: AddressDisplayProps) {
  const address = typeof value === 'string' ? value.trim() : ''

  if (address === '') {
    return <span className={`font-mono text-smoke ${className ?? ''}`}>—</span>
  }

  if (address.length <= 8) {
    return (
      <span className={`font-mono ${className ?? ''}`} title={address}>
        <b>{address}</b>
      </span>
    )
  }

  return (
    <span className={`font-mono ${className ?? ''}`} title={address}>
      <b>{address.slice(0, 4)}</b>
      {address.slice(4, -4)}
      <b>{address.slice(-4)}</b>
    </span>
  )
}
