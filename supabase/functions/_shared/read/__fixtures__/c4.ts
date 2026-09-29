import type { ReadPayload } from '../types.ts'

const BANNED = [
  { pattern: /!/, label: 'exclamation mark' },
  { pattern: /\b(I|we|our|us|my|me)\b/i, label: 'first person' },
  { pattern: /\bJEV\b/i, label: 'engine name' },
  { pattern: /\bAI\b/, label: 'AI mention' },
  { pattern: /win rate/i, label: 'win rate' },
  { pattern: /\bsignals?\b/i, label: 'signal language' },
  { pattern: /guarantee/i, label: 'guarantee' },
  { pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, label: 'emoji' },
]

export function collectCopy(payload: ReadPayload): string[] {
  const lines: string[] = [
    payload.verdict,
    payload.biasLine,
    payload.explainLead,
    payload.explainRest,
    payload.caution,
  ]
  for (const item of payload.evidence) {
    lines.push(item.label, item.state, item.detail)
  }
  for (const setup of payload.setups) {
    lines.push(setup.bias, setup.summary, ...setup.sees, setup.invalidation.note, setup.target.note)
  }
  for (const forming of payload.forming) {
    lines.push(forming.summary, forming.invalidation.note, forming.target.note, forming.condition ?? '')
  }
  for (const event of payload.changes) {
    lines.push(event.subject, event.text, event.detail)
  }
  for (const tag of Object.values(payload.tags)) {
    lines.push(tag.label)
  }
  return lines.filter((line) => line !== '')
}

export function findC4Violations(lines: string[]): string[] {
  const violations: string[] = []
  for (const line of lines) {
    for (const rule of BANNED) {
      if (rule.pattern.test(line)) violations.push(`${rule.label}: ${line}`)
    }
  }
  return violations
}
