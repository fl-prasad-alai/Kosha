import type { Tier } from '@/lib/perf'

/** Plays the opening inside `el`; returns a cleanup function. */
export function startIntro(el: HTMLElement, opts?: { tier?: Tier; onDone?: () => void }): () => void
