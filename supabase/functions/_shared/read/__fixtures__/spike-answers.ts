import type { JevResponse } from '../types.ts'

/** Raw jev-1.13.0 response from the Phase 1 spike (2026-09-27). Recorded verbatim. */
export const SPIKE_ANSWERS: JevResponse = {
  model: 'jev-1.13.0',
  answers: {
    regime: {
      type: 'choice',
      choice: 'cautious',
      confidence: 0.27,
      probabilities: { cautious: 0.41, risk_off: 0, neutral: 0.23, risk_on: 0.05, constructive: 0.31 },
    },
    stance: {
      type: 'choice',
      choice: 'wait',
      confidence: 0.87,
      probabilities: { unclear: 0.03, reduce_risk: 0.01, wait: 0.9, favorable: 0.06 },
    },
    bias: {
      type: 'choice',
      choice: 'bullish',
      confidence: 0.92,
      probabilities: { mixed: 0.02, bearish: 0, neutral: 0.04, bullish: 0.94 },
    },
    trend_strength: {
      type: 'score',
      score: 0.83,
      confidence: 0.7,
      legend: {
        '0': 'No side in control: breadth near even, majors mid-range, no higher highs or lower lows.',
        '1': 'Slight lean: one side marginally ahead while the other still counter-moves.',
        '2': 'Moderate control: breadth clearly one-sided and majors making higher highs or lower lows.',
        '3': 'Firm control: broad participation, consecutive higher highs or lower lows on majors.',
        '4': 'Total control: near-unanimous breadth, sustained one-directional moves, no meaningful counter-moves.',
      },
      probabilities: { '0': 0.26, '1': 0.65, '2': 0.08, '3': 0.01, '4': 0 },
    },
    risk: {
      type: 'score',
      score: 1.13,
      confidence: 0.78,
      legend: {
        '0': 'Low: volatility near its normal range, price far from the nearest level, broad participation.',
        '1': 'Medium: volatility above normal or price close to a contested level.',
        '2': 'High: volatility extreme or price at a level whose break would move the whole market.',
      },
      probabilities: { '0': 0.01, '1': 0.85, '2': 0.14 },
    },
    XRP_worth: { type: 'noul', noul: 0.52 },
    XRP_type: {
      type: 'choice',
      choice: 'momentum_turn',
      confidence: 1,
      probabilities: { range_break: 0, rejection_at_resistance: 0, none: 0, momentum_turn: 1, breakout_retest: 0 },
    },
    XRP_target_first: { type: 'noul', noul: 0.35 },
    XRP_risk: {
      type: 'score',
      score: 0.32,
      confidence: 0.52,
      legend: {
        '0': 'Low: the invalidation level is close and concrete, so a loss would be small and obvious.',
        '1': 'Medium: the invalidation level is concrete but requires patience, so a loss would be meaningful.',
        '2': 'High: the invalidation level is far or unclear, or ordinary noise could cross it.',
      },
      probabilities: { '0': 0.73, '1': 0.21, '2': 0.06 },
    },
  },
  usage: { input_tokens: 2184, output_tokens: 305 },
}
