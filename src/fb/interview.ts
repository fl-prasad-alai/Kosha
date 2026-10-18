// Voice interview: Gemini listens to one spoken answer (any language) and pulls out the facts.
import type { Part } from '@google/genai'
import { QUESTIONS } from '@shared/questions'
import type { InterviewAnswer, Profile, QuestionId } from '@shared/types'
import { generate, inline, GeminiError } from './gemini.ts'

const SCHEMA = {
  type: 'object',
  properties: {
    transcript: { type: 'string', description: 'Exactly what the owner said, in the language and script they used' },
    english: { type: 'string', description: 'Faithful English translation' },
    facts: {
      type: 'object',
      properties: {
        years: { type: ['number', 'null'], description: 'Years running the shop' },
        suppliers: { type: ['string', 'null'], description: 'Supplier names, comma separated' },
        purchasesPerWeek: { type: ['number', 'null'], description: 'How many wholesale buying trips per week' },
        busyDays: { type: ['string', 'null'] },
        peakSeasons: { type: ['string', 'null'], description: 'Festivals or seasons, comma separated' },
        creditOutstanding: { type: ['number', 'null'], description: 'Amount customers owe, in the local currency. Use the middle of a range.' },
        purpose: { type: ['string', 'null'], description: 'What the loan is for, in a short English phrase' },
        purposeCost: { type: ['number', 'null'], description: 'Cost of what they want to buy, local currency' },
        extraMonthlyProfit: { type: ['number', 'null'], description: 'Extra monthly profit they expect, local currency' },
      },
      required: ['years', 'suppliers', 'purchasesPerWeek', 'busyDays', 'peakSeasons', 'creditOutstanding', 'purpose', 'purposeCost', 'extraMonthlyProfit'],
    },
  },
  required: ['transcript', 'english', 'facts'],
}

const SYSTEM = `You are Kosha's interviewer. A small shop owner is answering one question about their shop, by voice or text, often in Hindi, Marathi, Tagalog, Bahasa Indonesia or a mix with English.
Transcribe faithfully, translate to English, and extract only the facts the answer actually states. Use null for anything not said. Do not judge the speaker's tone, accent or confidence.`

export async function readAnswer(
  id: QuestionId,
  profile: Partial<Profile>,
  input: { audio?: { data: string; mimetype: string }; text?: string },
): Promise<InterviewAnswer> {
  const q = QUESTIONS.find((x) => x.id === id)
  if (!q) throw new GeminiError('Unknown question.', 400)
  if (!input.audio && !input.text?.trim()) throw new GeminiError('Record or type an answer first.', 400)
  const parts: Part[] = [
    {
      text: `Shop: ${profile.shopName ?? ''} (${profile.country ?? ''}, currency ${profile.currency ?? ''}).
Question asked: "${q.english}"${profile.language && q.local[profile.language] ? ` / "${q.local[profile.language]}"` : ''}
${input.audio ? 'The answer is in the audio.' : `The owner typed: """${input.text}"""`}`,
    },
  ]
  if (input.audio) parts.push(inline(input.audio.data, input.audio.mimetype.split(';')[0] || 'audio/webm'))
  const res = await generate<Omit<InterviewAnswer, 'id' | 'meta'>>({
    task: 'interview.v1',
    system: SYSTEM,
    parts,
    schema: SCHEMA,
    maxOutputTokens: 4096,
  })
  return { id, ...res.data, facts: res.data.facts ?? {}, meta: res.meta }
}
