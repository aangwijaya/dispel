import type { MarketRead, Regime, Stance, Tone } from '../../types/read'
import heroArt from '../../assets/dispel-hero.svg'
import waitArt from '../../assets/aura-wait.svg'
import unclearArt from '../../assets/aura-unclear.svg'
import riskoffArt from '../../assets/aura-riskoff.svg'

export const REGIMES: Regime[] = [
  { name: 'Risk-off', color: '#f0506e' },
  { name: 'Cautious', color: '#e8b04a' },
  { name: 'Neutral', color: '#9c9c9d' },
  { name: 'Constructive', color: '#8fd9b3' },
  { name: 'Risk-on', color: '#59d499' },
]

export const STANCE_COLOR: Record<Stance, string> = {
  favorable: '#59d499',
  wait: '#e8b04a',
  unclear: '#9c9c9d',
  'reduce-risk': '#f0506e',
}

export const VERDICT_TINT: Record<Stance, string> = {
  favorable: '#a6efc9',
  wait: '#f5d08a',
  unclear: '#bdbdbf',
  'reduce-risk': '#ffa3b4',
}

export const AURA_ART: Record<Stance, string> = {
  favorable: heroArt,
  wait: waitArt,
  unclear: unclearArt,
  'reduce-risk': riskoffArt,
}

export const TONE_COLOR: Record<Tone, string> = {
  up: '#59d499',
  down: '#f0506e',
  caution: '#e8b04a',
  neutral: '#9c9c9d',
}

export const BIAS_LABEL = ['Low', 'Medium', 'High'] as const

export const VOLATILITY_LABEL = ['Low', 'Normal', 'Elevated', 'Extreme'] as const

export function regimeAt(index: number): Regime {
  return REGIMES[index] ?? { name: 'Neutral', color: '#9c9c9d' }
}

export function oddsTexture(confidence: 0 | 1 | 2): string {
  return ['thin', 'medium', ''][confidence] ?? ''
}

export function rng(seed: number): () => number {
  let a = seed * 9301 + 49297
  return () => {
    a = (a * 9301 + 49297) % 233280
    return a / 233280
  }
}

export function series(anchors: number[], seed: number, n = 56): number[] {
  if (anchors.length === 0) return []
  const random = rng(seed)
  const out: number[] = []
  const lo = Math.min(...anchors)
  const hi = Math.max(...anchors)
  const amp = (hi - lo) * 0.06
  const lastAnchor = anchors[anchors.length - 1] ?? 0
  let noise = 0
  for (let i = 0; i < n; i++) {
    const p = (i / (n - 1)) * (anchors.length - 1)
    const k = Math.floor(p)
    const f = p - k
    const start = anchors[k] ?? lastAnchor
    const end = anchors[k + 1] ?? start
    const base = start + (end - start) * f
    noise = noise * 0.55 + (random() - 0.5) * amp
    out.push(i === n - 1 ? lastAnchor : base + noise)
  }
  return out
}

const READ_TIME = '14:32 UTC'

const FAVORABLE: MarketRead = {
  stance: 'favorable',
  verdict: 'Look for setups',
  bias: 'Bullish',
  biasTone: 'up',
  biasLine: 'buyers in moderate control',
  explainLead: 'Buyers have held control since BTC reclaimed 116.4k this morning.',
  explainRest:
    '12 of 18 markets are up on the day, but several majors are now pressing into resistance, so the easy part of this move may already be done.',
  caution: 'Avoid chasing extended moves. Let pullbacks prove support before acting.',
  time: READ_TIME,
  coverage: '18 markets',
  regimeIndex: 3,
  ribbon: [
    { from: 0, to: 10.7, regime: 2 },
    { from: 10.7, to: 14.53, regime: 3 },
  ],
  shift: { time: '10:42', from: 2, to: 3, why: 'BTC reclaimed 116.4k while market-wide volume strengthened.' },
  stats: { strength: 71, confidence: 1, risk: 1, volatility: 1 },
  evidence: [
    { label: 'Trend', state: 'Up', tone: 'up', detail: 'Higher highs on BTC and ETH 4h' },
    { label: 'Momentum', state: 'Firming', tone: 'up', detail: 'BTC 1h RSI 58, rising' },
    { label: 'Volume', state: 'Above avg', tone: 'up', detail: '+18% vs 7-day average' },
    { label: 'Volatility', state: 'Normal', tone: 'neutral', detail: 'ATR inside its 30-day band' },
    { label: 'Breadth', state: '12 / 18 up', tone: 'up', detail: 'Participation widening' },
    { label: 'Levels', state: 'At resistance', tone: 'caution', detail: 'BTC 119.2k · support 115.8k' },
    { label: 'Positioning', state: 'Balanced', tone: 'neutral', detail: 'BTC funding +0.010% 8h · OI +2.4% 24h' },
    { label: 'On-chain', state: 'Supports', tone: 'up', detail: 'BTC netflow −8,400 7d · as of Sep 27' },
  ],
  setups: [
    {
      symbol: 'SOL/USDT',
      monogram: 'SOL',
      bias: 'Bullish',
      tone: 'up',
      summary: 'Pullback is holding above the 208 breakout. Buyers defended it twice in the last hour.',
      odds: 68,
      confidence: 2,
      risk: 1,
      horizon: '15m – 1h',
      price: '212.84',
      changePct: 3.42,
      sees: ['Retest of broken resistance held on rising volume', 'Higher low at 209.1 on the 15m', 'Market regime supports longs'],
      invalidation: { value: '206.50', note: '1h candle closes back below the breakout' },
      target: { value: '219.00', note: 'Prior swing high' },
      anchors: [199, 201.5, 204, 209, 214.2, 211, 208.6, 210.4, 209.1, 211.8, 212.84],
      seed: 3,
    },
    {
      symbol: 'LINK/USDT',
      monogram: 'LNK',
      bias: 'Bullish',
      tone: 'up',
      isNew: true,
      summary: 'Broke out of a 9-day range on twice its usual volume. Already extended from the base.',
      odds: 64,
      confidence: 1,
      risk: 2,
      horizon: '15m – 1h',
      price: '24.61',
      changePct: 5.18,
      sees: ['Range high 23.80 cleared on 2.1× volume', 'First breakout in 9 days', 'Thin order book above 25.00'],
      invalidation: { value: '23.60', note: 'Price falls back inside the range' },
      target: { value: '25.40', note: 'Measured move of the range' },
      anchors: [22.9, 23.3, 22.8, 23.5, 23.1, 23.6, 23.2, 23.7, 24.3, 24.9, 24.61],
      seed: 11,
    },
    {
      symbol: 'ETH/USDT',
      monogram: 'ETH',
      bias: 'Bullish',
      tone: 'up',
      summary: 'Momentum is turning up after two days of basing just under 4,640.',
      odds: 61,
      confidence: 1,
      risk: 0,
      horizon: '1h – 4h',
      price: '4,612.30',
      changePct: 0.84,
      sees: ['Two-day base with falling volatility', '1h momentum turned positive at 13:00', 'Close to support, so risk is well defined'],
      invalidation: { value: '4,540', note: '4h close below the base' },
      target: { value: '4,780', note: 'Top of the weekly range' },
      anchors: [4555, 4590, 4570, 4600, 4585, 4610, 4580, 4598, 4605, 4618, 4612.3],
      seed: 7,
    },
    {
      symbol: 'BTC/USDT',
      monogram: 'BTC',
      bias: 'Bearish lean',
      tone: 'down',
      summary: 'Third test of 119.2k resistance. Each bounce is weaker, so rejection risk is rising.',
      odds: 55,
      confidence: 0,
      risk: 1,
      horizon: '1h – 4h',
      price: '118,420.50',
      changePct: 1.12,
      sees: ['Lower momentum on each test of 119.2k', 'Volume fading into resistance', 'Conflicts with the bullish regime, hence low confidence'],
      invalidation: { value: '119,600', note: 'Clean 1h close above resistance' },
      target: { value: '116,400', note: 'This morning’s reclaim level' },
      anchors: [115900, 116400, 117800, 119100, 118300, 119150, 118500, 119050, 118700, 118420],
      seed: 5,
    },
  ],
  forming: [],
  exposure: [],
  changes: [
    { time: '14:26', subject: 'BTC', kind: 'caution', text: 'Third test of 119.2k resistance', detail: 'Rejections here have preceded 2–3% pullbacks' },
    { time: '14:10', subject: 'ETH', kind: 'info', text: 'Momentum improving on the 1h', detail: 'Momentum' },
    { time: '13:52', subject: 'SOL', kind: 'info', text: 'Volume 2.1× its 20-period average', detail: 'Volume' },
    { time: '13:31', subject: 'DOGE', kind: 'caution', text: 'Swinging ±4% within an hour', detail: 'Volatility · not a setup for this reason' },
    { time: '10:42', subject: 'Market', kind: 'shift', text: 'Regime shift: Neutral → Constructive', detail: 'BTC reclaimed 116.4k as volume strengthened' },
  ],
  since: [
    { kind: 'chg', label: 'Bias', text: 'Neutral → Bullish' },
    { kind: 'same', label: 'Risk', text: 'Medium, unchanged' },
    { kind: 'new', label: 'Setup', text: 'LINK breakout added' },
    { kind: 'end', label: 'Setup', text: 'AVAX reached target, removed' },
  ],
  breadth: { up: 12, down: 6 },
  tags: {
    BTC: { label: 'At resistance', tone: 'caution' },
    ETH: { label: 'Setup', tone: 'up' },
    SOL: { label: 'Setup', tone: 'up' },
    LINK: { label: 'Setup · new', tone: 'up' },
    ARB: { label: '—', tone: 'neutral' },
  },
}

const WAIT: MarketRead = {
  stance: 'wait',
  verdict: 'Wait.',
  bias: 'Mixed',
  biasTone: 'caution',
  biasLine: 'no side in control',
  explainLead: 'Direction is mixed and volatility is elevated.',
  explainRest:
    'BTC was rejected at 119.2k twice, and the rest of the market is following it in both directions within the same hour.',
  caution: 'No setup is strong enough to chase right now. Sitting out is a position.',
  time: READ_TIME,
  coverage: '18 markets',
  regimeIndex: 1,
  ribbon: [
    { from: 0, to: 10.7, regime: 2 },
    { from: 10.7, to: 13.08, regime: 3 },
    { from: 13.08, to: 14.53, regime: 1 },
  ],
  shift: { time: '13:05', from: 3, to: 1, why: 'BTC lost 117k on heavy volume and volatility doubled across majors.' },
  stats: { strength: 44, confidence: 2, risk: 2, volatility: 2 },
  evidence: [
    { label: 'Trend', state: 'Broken', tone: 'caution', detail: 'BTC lost this morning’s higher low' },
    { label: 'Momentum', state: 'Whipsaw', tone: 'caution', detail: 'Flipped direction 4× in 3 hours' },
    { label: 'Volume', state: 'Heavy', tone: 'neutral', detail: 'Spikes on both sides' },
    { label: 'Volatility', state: 'Elevated', tone: 'caution', detail: 'ATR 1.9× its 30-day median' },
    { label: 'Breadth', state: '7 / 18 up', tone: 'down', detail: 'Participation narrowing' },
    { label: 'Levels', state: 'Mid-range', tone: 'neutral', detail: 'BTC between 115.8k and 119.2k' },
    { label: 'Positioning', state: 'Leverage rising', tone: 'caution', detail: 'BTC funding +0.014% 8h · OI +6.1% 24h' },
    { label: 'On-chain', state: 'Unclear', tone: 'neutral', detail: 'Flows mixed · as of Sep 27' },
  ],
  setups: [],
  forming: [
    {
      symbol: 'ETH/USDT',
      monogram: 'ETH',
      bias: 'Watching',
      tone: 'neutral',
      summary: 'Holding its base better than the rest of the market.',
      odds: null,
      confidence: 0,
      risk: 1,
      horizon: '1h – 4h',
      price: '4,588.10',
      changePct: -0.52,
      condition: 'Needs BTC to stabilise above 116k first.',
      sees: [],
      invalidation: { value: '—', note: 'Not formed yet' },
      target: { value: '—', note: 'Not formed yet' },
      anchors: [4600, 4590, 4610, 4560, 4585, 4570, 4592, 4580, 4588],
      seed: 7,
    },
    {
      symbol: 'SOL/USDT',
      monogram: 'SOL',
      bias: 'Watching',
      tone: 'neutral',
      summary: 'Lost the 208 breakout and is now testing 204 support.',
      odds: null,
      confidence: 0,
      risk: 1,
      horizon: '15m – 1h',
      price: '205.20',
      changePct: -1.84,
      condition: 'Needs a close back above 208.',
      sees: [],
      invalidation: { value: '—', note: 'Not formed yet' },
      target: { value: '—', note: 'Not formed yet' },
      anchors: [212, 210, 206, 208, 203.5, 205.8, 204.1, 205.2],
      seed: 3,
    },
  ],
  exposure: [],
  changes: [
    { time: '14:21', subject: 'Market', kind: 'caution', text: 'Volatility elevated in 14 of 18 markets', detail: 'Wider swings mean wider mistakes' },
    { time: '14:02', subject: 'BTC', kind: 'caution', text: 'Second rejection at 119.2k', detail: 'Levels' },
    { time: '13:40', subject: 'SOL', kind: 'caution', text: 'Setup invalidated: closed below 206.50', detail: 'Removed from setups' },
    { time: '13:05', subject: 'Market', kind: 'shift', text: 'Regime shift: Constructive → Cautious', detail: 'BTC lost 117k on heavy volume' },
    { time: '12:48', subject: 'PEPE', kind: 'caution', text: 'Moves of ±11% in 30 minutes', detail: 'Volatility · extreme' },
  ],
  since: [
    { kind: 'chg', label: 'Bias', text: 'Bullish → Mixed' },
    { kind: 'chg', label: 'Risk', text: 'Medium → High' },
    { kind: 'end', label: 'Setup', text: 'SOL invalidated at 13:40' },
    { kind: 'end', label: 'Setup', text: 'LINK expired as volume faded' },
  ],
  breadth: { up: 7, down: 11 },
  tags: {
    BTC: { label: 'Rejected', tone: 'caution' },
    ETH: { label: 'Forming', tone: 'neutral' },
    SOL: { label: 'Invalidated', tone: 'down' },
    LINK: { label: '—', tone: 'neutral' },
    ARB: { label: 'High vol', tone: 'caution' },
  },
}

const UNCLEAR: MarketRead = {
  stance: 'unclear',
  verdict: 'No clear read',
  bias: 'Neutral',
  biasTone: 'neutral',
  biasLine: 'range-bound, low participation',
  explainLead: 'Volume is thin and prices are compressing into tight ranges.',
  explainRest:
    'Too little is happening to lean either way, and a direction won’t be invented where there isn’t one.',
  caution: 'Compression usually ends with a sharp move. Know your levels before it arrives.',
  time: READ_TIME,
  coverage: '18 markets',
  regimeIndex: 2,
  ribbon: [{ from: 0, to: 14.53, regime: 2 }],
  shift: null,
  stats: { strength: 50, confidence: 0, risk: 1, volatility: 0 },
  evidence: [
    { label: 'Trend', state: 'Flat', tone: 'neutral', detail: 'No new highs or lows since Tuesday' },
    { label: 'Momentum', state: 'Neutral', tone: 'neutral', detail: 'RSI 48–52 on majors' },
    { label: 'Volume', state: 'Thin', tone: 'caution', detail: '−31% vs 7-day average' },
    { label: 'Volatility', state: 'Low', tone: 'neutral', detail: 'Tightest 4h range in 11 days' },
    { label: 'Breadth', state: '9 / 18 up', tone: 'neutral', detail: 'Evenly split' },
    { label: 'Levels', state: 'Mid-range', tone: 'neutral', detail: 'BTC 116.9k – 118.6k box' },
    { label: 'Positioning', state: 'Balanced', tone: 'neutral', detail: 'Funding near zero · OI flat' },
    { label: 'On-chain', state: 'Unclear', tone: 'neutral', detail: 'Quiet flows · as of Sep 27' },
  ],
  setups: [
    {
      symbol: 'BTC/USDT',
      monogram: 'BTC',
      bias: 'Either way',
      tone: 'neutral',
      summary: 'Coiling inside a 1.4% box. The setup is the break of 118.6k or 116.9k, not the box itself.',
      odds: null,
      confidence: 0,
      risk: 1,
      horizon: '1h – 4h',
      price: '117,820.00',
      changePct: 0.12,
      condition: 'Conditional: waits for a close outside the box',
      sees: ['Tightest range in 11 days', 'Volume drying up, as it often does before a larger move', 'No directional edge inside the box'],
      invalidation: { value: 'Inside', note: 'Any move back into the box after a break' },
      target: { value: '±1.5%', note: 'Box height projected from the break' },
      anchors: [117300, 118200, 117100, 118400, 117400, 118100, 117600, 117900, 117700, 117820],
      seed: 5,
    },
    {
      symbol: 'ETH/USDT',
      monogram: 'ETH',
      bias: 'Either way',
      tone: 'neutral',
      summary: 'Range of 4,580–4,660 for three days. Watch which side breaks first.',
      odds: null,
      confidence: 0,
      risk: 1,
      horizon: '1h – 4h',
      price: '4,612.30',
      changePct: -0.08,
      condition: 'Conditional: waits for a range break',
      sees: ['Three touches on each side', 'Lower volume on each test', 'Tracks BTC closely, so watch the BTC box too'],
      invalidation: { value: 'Inside', note: 'A failed break back into the range' },
      target: { value: '±80', note: 'Range height' },
      anchors: [4600, 4650, 4590, 4655, 4585, 4640, 4600, 4630, 4612],
      seed: 7,
    },
  ],
  forming: [],
  exposure: [],
  changes: [
    { time: '14:30', subject: 'Market', kind: 'info', text: 'Volume 31% below its 7-day average', detail: 'Thin markets move on small orders' },
    { time: '13:58', subject: 'BTC', kind: 'caution', text: 'Tightest 4h range in 11 days', detail: 'Compression' },
    { time: '12:15', subject: 'ETH', kind: 'info', text: 'Third touch of 4,580 range support', detail: 'Levels' },
    { time: '09:40', subject: 'Market', kind: 'info', text: 'No regime change for 26 hours', detail: 'Regime' },
  ],
  since: [
    { kind: 'same', label: 'Bias', text: 'Neutral, unchanged' },
    { kind: 'same', label: 'Risk', text: 'Medium, unchanged' },
    { kind: 'chg', label: 'Volume', text: 'Thinning: −12% since you left' },
    { kind: 'new', label: 'Setup', text: 'ETH range added' },
  ],
  breadth: { up: 9, down: 9 },
  tags: {
    BTC: { label: 'Compressing', tone: 'neutral' },
    ETH: { label: 'Range', tone: 'neutral' },
    SOL: { label: '—', tone: 'neutral' },
    LINK: { label: '—', tone: 'neutral' },
    ARB: { label: '—', tone: 'neutral' },
  },
}

const REDUCE_RISK: MarketRead = {
  stance: 'reduce-risk',
  verdict: 'Reduce risk',
  bias: 'Bearish',
  biasTone: 'down',
  biasLine: 'sellers in firm control',
  explainLead: 'Sellers took control when BTC broke 115.8k support on three times its usual volume.',
  explainRest:
    '15 of 18 markets are down and volatility is the highest it has been this month. In a market like this, protecting what you hold matters more than finding something new.',
  caution: 'If you hold positions, check them against their invalidation levels. Avoid buying the first bounce.',
  time: READ_TIME,
  coverage: '18 markets',
  regimeIndex: 0,
  ribbon: [
    { from: 0, to: 9.5, regime: 2 },
    { from: 9.5, to: 13.67, regime: 1 },
    { from: 13.67, to: 14.53, regime: 0 },
  ],
  shift: { time: '13:40', from: 1, to: 0, why: 'BTC broke 115.8k support on 3× volume and breadth collapsed to 3 of 18.' },
  stats: { strength: 78, confidence: 2, risk: 2, volatility: 3 },
  evidence: [
    { label: 'Trend', state: 'Down', tone: 'down', detail: 'BTC broke 115.8k, lower lows on 4h' },
    { label: 'Momentum', state: 'Falling', tone: 'down', detail: 'BTC 1h RSI 29, still falling' },
    { label: 'Volume', state: 'Heavy selling', tone: 'down', detail: '3.1× average on down candles' },
    { label: 'Volatility', state: 'Extreme', tone: 'caution', detail: 'ATR 2.6× its 30-day median' },
    { label: 'Breadth', state: '3 / 18 up', tone: 'down', detail: 'Selling is broad, not isolated' },
    { label: 'Levels', state: 'Below support', tone: 'down', detail: 'Next BTC support 112.4k' },
    { label: 'Positioning', state: 'Crowded long', tone: 'caution', detail: 'BTC funding +0.021% 8h · OI +4.9% 24h' },
    { label: 'On-chain', state: 'Contradicts', tone: 'down', detail: 'Inflows into exchanges · as of Sep 27' },
  ],
  setups: [],
  forming: [],
  exposure: [
    {
      symbol: 'SOL/USDT',
      monogram: 'SOL',
      status: 'Invalidated',
      tone: 'down',
      holding: '12.50 SOL',
      entry: '201.46',
      price: '196.20',
      changePct: -4.62,
      plPct: -2.61,
      cushionPct: null,
      summary: 'Closed below its 206.50 invalidation at 13:40. The setup behind this position is no longer valid.',
      sees: ['1h close below the old breakout at 206.50', 'Retest from below failed at 205.9', 'Selling volume 2.4× average'],
      invalidation: { value: '206.50', note: 'Broken at 13:40 on a 1h close' },
      target: { value: '192.00', note: 'Next support below' },
      anchors: [212, 210.4, 207.8, 208.9, 205.1, 203, 205.9, 199.5, 197.1, 196.2],
      seed: 3,
    },
    {
      symbol: 'ETH/USDT',
      monogram: 'ETH',
      status: 'At risk',
      tone: 'caution',
      holding: '0.60 ETH',
      entry: '4,545.55',
      price: '4,567.80',
      changePct: -1.12,
      plPct: 0.49,
      cushionPct: 0.6,
      summary: 'Still above its 4,540 base, but only 0.6% away while the rest of the market sells off.',
      sees: ['Holding better than BTC so far', 'Base support at 4,540 tested twice today', 'Tracks BTC closely, so a BTC leg down would likely take it along'],
      invalidation: { value: '4,540', note: 'A 4h close below the base' },
      target: { value: '4,470', note: 'Next support below' },
      anchors: [4640, 4620, 4600, 4585, 4610, 4572, 4590, 4560, 4568],
      seed: 7,
    },
  ],
  changes: [
    { time: '14:24', subject: 'You', kind: 'caution', text: 'Your SOL position is below its invalidation level', detail: '12.50 SOL · entry 201.46 · level 206.50' },
    { time: '14:05', subject: 'Market', kind: 'caution', text: 'Volatility at a 30-day high in 16 of 18 markets', detail: 'Wider swings mean wider mistakes' },
    { time: '13:52', subject: 'BTC', kind: 'caution', text: 'Retest of 115.8k from below failed', detail: 'Levels · old support is now resistance' },
    { time: '13:40', subject: 'Market', kind: 'shift', text: 'Regime shift: Cautious → Risk-off', detail: 'BTC broke 115.8k on 3× volume' },
    { time: '13:40', subject: 'SOL', kind: 'caution', text: 'Setup invalidated: closed below 206.50', detail: 'Removed from setups' },
  ],
  since: [
    { kind: 'chg', label: 'Bias', text: 'Bullish → Bearish' },
    { kind: 'chg', label: 'Risk', text: 'Medium → High' },
    { kind: 'end', label: 'Setup', text: 'SOL invalidated. You hold 12.50 SOL' },
    { kind: 'end', label: 'Setup', text: 'ETH and LINK removed' },
  ],
  breadth: { up: 3, down: 15 },
  tags: {
    BTC: { label: 'Support lost', tone: 'down' },
    ETH: { label: 'At risk', tone: 'caution' },
    SOL: { label: 'Invalidated', tone: 'down' },
    LINK: { label: '—', tone: 'neutral' },
    ARB: { label: 'High vol', tone: 'caution' },
  },
}

export const DEMO_READS: Record<Stance, MarketRead> = {
  favorable: FAVORABLE,
  wait: WAIT,
  unclear: UNCLEAR,
  'reduce-risk': REDUCE_RISK,
}

export const DEMO_READ = FAVORABLE
