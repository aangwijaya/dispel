export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }
