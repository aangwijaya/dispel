interface PctProps {
  value: number
  digits?: number
}

export function Pct({ value, digits = 2 }: PctProps) {
  const tone = value > 0 ? 'up' : value < 0 ? 'down' : 'smoke'
  return (
    <span className={tone}>
      {value > 0 ? '+' : ''}
      {value.toFixed(digits)}%
    </span>
  )
}
