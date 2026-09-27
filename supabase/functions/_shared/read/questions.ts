import type { Candidate } from './types.ts'

export interface JevChoiceQuestion {
  type: 'choice'
  instructions: string
  criteria: Record<string, string>
}

export interface JevScoreQuestion {
  type: 'score'
  instructions: string
  criteria: string[]
}

export interface JevNoulQuestion {
  type: 'noul'
  instructions: string
  criteria: { true: string; false: string }
}

export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion

export const MARKET_QUESTION_IDS = ['regime', 'stance', 'bias', 'trend_strength', 'risk'] as const

export const MARKET_QUESTIONS: Record<string, JevQuestion> = {
  regime: {
    type: 'choice',
    instructions: 'Classify the crypto market regime described by `as_of_utc`, `breadth`, `btc` and `eth`.',
    criteria: {
      risk_off:
        'Sellers in firm control: broad declines, BTC or ETH below a broken support level, volatility expanding.',
      cautious:
        'Weakening market: mixed or negative breadth, failed bounces, volatility elevated, no side firmly in control.',
      neutral: 'Balanced market: breadth near even, majors mid-range, ordinary volatility, no directional edge.',
      constructive: 'Buyers gaining: breadth improving and BTC or ETH holding higher lows above support.',
      risk_on:
        'Buyers in firm control: broad participation, higher highs and higher lows on BTC and ETH, volatility contained.',
    },
  },
  stance: {
    type: 'choice',
    instructions:
      "Given the market in `breadth`, `btc` and `eth`, and the candidate setups in `candidates`, what should a trader's stance be right now?",
    criteria: {
      favorable: 'Clear direction and conditions support looking for entries now.',
      wait: 'Direction is mixed or volatility is elevated; no setup is strong enough to chase right now.',
      unclear: 'Too little is happening to lean either way; the state does not support a direction.',
      reduce_risk:
        'Sellers are in control or support has broken; protecting existing positions matters more than finding new ones.',
    },
  },
  bias: {
    type: 'choice',
    instructions: 'What is the overall directional bias of the market in `breadth`, `btc` and `eth`?',
    criteria: {
      bullish: 'Net upward pressure: breadth positive and BTC or ETH holding above their support levels.',
      bearish: 'Net downward pressure: breadth negative and BTC or ETH below their support levels.',
      mixed: 'Both sides active: breadth split and BTC and ETH giving conflicting signals.',
      neutral: 'No directional pressure: breadth near even and both majors mid-range.',
    },
  },
  trend_strength: {
    type: 'score',
    instructions: 'How firmly does one side control price in `breadth`, `btc` and `eth` right now?',
    criteria: [
      'No side in control: breadth near even, majors mid-range, no higher highs or lower lows.',
      'Slight lean: one side marginally ahead while the other still counter-moves.',
      'Moderate control: breadth clearly one-sided and majors making higher highs or lower lows.',
      'Firm control: broad participation, consecutive higher highs or lower lows on majors.',
      'Total control: near-unanimous breadth, sustained one-directional moves, no meaningful counter-moves.',
    ],
  },
  risk: {
    type: 'score',
    instructions: 'How costly would being wrong be right now, judged from `btc`, `eth` and `breadth`?',
    criteria: [
      'Low: volatility near its normal range, price far from the nearest level, broad participation.',
      'Medium: volatility above normal or price close to a contested level.',
      'High: volatility extreme or price at a level whose break would move the whole market.',
    ],
  },
}

export function candidateQuestions(symbol: string): Record<string, JevQuestion> {
  return {
    [`${symbol}_worth`]: {
      type: 'noul',
      instructions: `Is the setup described in \`candidates.${symbol}\` worth a trader investigating now, given the market context in \`breadth\`, \`btc\` and \`eth\`?`,
      criteria: {
        true: 'Worth investigating: the pattern is clearly present, the levels are concrete, and the market context does not contradict it.',
        false:
          'Not worth investigating: the pattern is weak or ambiguous, the levels are unclear, or the market context contradicts it.',
      },
    },
    [`${symbol}_type`]: {
      type: 'choice',
      instructions: `Which pattern best describes the setup in \`candidates.${symbol}\`?`,
      criteria: {
        breakout_retest: 'A breakout above a range or level that has been retested and is holding above the broken level.',
        momentum_turn: 'A base or pullback where short-term momentum has just turned in the trade direction.',
        range_break: 'Price breaking or pressing out of a multi-day range on above-average volume.',
        rejection_at_resistance: 'A repeated test of a resistance level with weakening momentum or volume.',
        none: `None of these describes the setup in \`candidates.${symbol}\`.`,
      },
    },
    [`${symbol}_target_first`]: {
      type: 'noul',
      instructions: `Will the price in \`candidates.${symbol}\` reach \`candidates.${symbol}.target\` before \`candidates.${symbol}.invalidation\` within \`candidates.${symbol}.horizon\`?`,
      criteria: {
        true: 'The target is reached before the invalidation level within the stated horizon.',
        false:
          'The invalidation level is reached first, or neither level is reached within the stated horizon.',
      },
    },
    [`${symbol}_risk`]: {
      type: 'score',
      instructions: `What is the risk of acting on the setup in \`candidates.${symbol}\`?`,
      criteria: [
        'Low: the invalidation level is close and concrete, so a loss would be small and obvious.',
        'Medium: the invalidation level is concrete but requires patience, so a loss would be meaningful.',
        'High: the invalidation level is far or unclear, or ordinary noise could cross it.',
      ],
    },
  }
}

export function candidateQuestionIds(symbol: string): string[] {
  return [`${symbol}_worth`, `${symbol}_type`, `${symbol}_target_first`, `${symbol}_risk`]
}

export function buildQuestions(candidates: Candidate[]): Record<string, JevQuestion> {
  const questions: Record<string, JevQuestion> = { ...MARKET_QUESTIONS }
  for (const candidate of candidates) {
    Object.assign(questions, candidateQuestions(candidate.symbol))
  }
  return questions
}
