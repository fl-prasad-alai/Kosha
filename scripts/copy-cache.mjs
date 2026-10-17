// Ships the baked Gemini results and voice clips for the sample shops with the web app,
// so the samples load instantly and never spend a Gemini call.
import { cpSync, mkdirSync, readdirSync } from 'node:fs'

const out = 'dist/web/cache'
mkdirSync(`${out}/tts`, { recursive: true })
for (const f of readdirSync('cache')) if (f.endsWith('.json')) cpSync(`cache/${f}`, `${out}/${f}`)
for (const f of readdirSync('cache/tts')) if (f.endsWith('.wav')) cpSync(`cache/tts/${f}`, `${out}/tts/${f}`)
console.log('Copied sample cache to', out)
