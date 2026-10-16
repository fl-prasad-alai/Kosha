import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ImagePlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'
const MAX = 12 * 1024 * 1024

interface Props {
  files: File[]
  urls: string[]
  onChange: (files: File[]) => void
  label: string
  hint: string
  multiple?: boolean
  max?: number
  disabled?: boolean
  className?: string
}

export function Dropzone({ files, urls, onChange, label, hint, multiple = true, max = 8, disabled, className }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = (incoming: File[]) => {
    setError(null)
    const ok = incoming.filter((f) => ACCEPT.split(',').includes(f.type) && f.size <= MAX)
    if (ok.length < incoming.length) setError('Some files were skipped. Use JPG, PNG, WEBP, HEIC or PDF under 12 MB.')
    const next = multiple ? [...files, ...ok].slice(0, max) : ok.slice(0, 1)
    if (multiple && files.length + ok.length > max) setError(`Up to ${max} files at a time.`)
    if (next.length) onChange(next)
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          add(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          'group flex w-full items-center gap-4 rounded-2xl border border-dashed border-line-2 p-4 text-left transition',
          'hover:border-gold/60 hover:bg-gold/5 focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-50',
          over && 'border-gold bg-gold/10',
        )}
        style={{ borderColor: over ? undefined : 'var(--k-line-2)' }}
      >
        <motion.span animate={over ? { scale: 1.1, rotate: -6 } : { scale: 1, rotate: 0 }} className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
          <ImagePlus className="size-5" />
        </motion.span>
        <span className="min-w-0">
          <span className="block font-medium">{label}</span>
          <span className="block text-sm text-ink-2">{hint}</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        hidden
        onChange={(e) => {
          add(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      {error && <p className="mt-2 text-sm text-vermilion">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {files.map((f, i) => (
              <motion.li key={urls[i] ?? f.name + i} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="group/t relative">
                {f.type.startsWith('image/') ? (
                  <img src={urls[i]} alt={f.name} className="size-16 rounded-lg border border-line object-cover" />
                ) : (
                  <span className="grid size-16 place-items-center rounded-lg border border-line bg-glass font-mono text-[10px] text-ink-2">PDF</span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, k) => k !== i))}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-night text-ink-2 opacity-0 ring-1 ring-line transition group-hover/t:opacity-100 hover:text-vermilion focus-visible:opacity-100"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="size-3" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
