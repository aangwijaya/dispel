interface AddressDisplayProps {
  value: string | null | undefined
  className?: string
}

export function AddressDisplay({ value, className }: AddressDisplayProps) {
  const address = typeof value === 'string' ? value.trim() : ''

  if (address === '') {
    return <span className={`font-mono text-faint ${className ?? ''}`}>—</span>
  }

  if (address.length <= 8) {
    return (
      <span className={`font-mono ${className ?? ''}`} title={address}>
        <span className="text-accent">{address}</span>
      </span>
    )
  }

  return (
    <span className={`font-mono ${className ?? ''}`} title={address}>
      <span className="text-accent">{address.slice(0, 4)}</span>
      {address.slice(4, -4)}
      <span className="text-accent">{address.slice(-4)}</span>
    </span>
  )
}
