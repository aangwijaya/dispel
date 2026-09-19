const AUTH_ERRORS: Array<[string, string]> = [
  ['invalid login credentials', 'Incorrect email or password.'],
  ['email not confirmed', 'Confirm your email address first, then sign in.'],
  ['user already registered', 'An account with this email already exists.'],
  ['password should be at least', 'Password must be at least 8 characters.'],
  ['unable to validate email', 'Enter a valid email address.'],
  ['email rate limit', 'Too many emails requested. Wait a moment and try again.'],
  ['rate limit', 'Too many attempts. Wait a moment and try again.'],
]

const DB_ERRORS: Array<[string, string]> = [
  ['insufficient_balance', 'Insufficient cash balance for this order.'],
  ['insufficient_position', 'Insufficient position quantity to sell.'],
  ['order_not_found', 'Order not found.'],
  ['order_not_open', 'This order is no longer open.'],
  ['limit_not_crossed', 'Limit price has not been reached.'],
  ['invalid_symbol', 'Unsupported market symbol.'],
  ['invalid_side', 'Invalid order side.'],
  ['invalid_type', 'Invalid order type.'],
  ['invalid_price', 'Invalid price.'],
  ['invalid_quantity', 'Invalid quantity.'],
  ['invalid_reference_price', 'Market price unavailable. Try again.'],
  ['notional_too_small', 'Order value is too small.'],
  ['not_authenticated', 'Your session expired. Sign in again.'],
  ['account_not_found', 'Paper account not found.'],
  ['not_owner', 'You do not have access to this order.'],
]

function matchFriendly(message: string | undefined, table: Array<[string, string]>): string | null {
  if (!message) return null
  const lower = message.toLowerCase()
  for (const [needle, friendly] of table) {
    if (lower.includes(needle)) return friendly
  }
  return null
}

export function friendlyAuthError(message: string | undefined): string {
  return matchFriendly(message, AUTH_ERRORS) ?? 'Authentication failed. Please try again.'
}

export function friendlyDbError(message: string | undefined): string {
  return matchFriendly(message, DB_ERRORS) ?? 'The request could not be completed. Please try again.'
}
