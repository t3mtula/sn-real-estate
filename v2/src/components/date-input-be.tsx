/**
 * DateInputBE — Thai Buddhist Era date text input
 *
 * Stores and emits "DD/MM/YYYY" in BE year (พ.ศ.)
 * e.g. "01/06/2569" = 1 June 2026 CE
 *
 * Usage with react-hook-form Controller:
 *
 *   <Controller
 *     control={form.control}
 *     name="start"
 *     render={({ field }) => (
 *       <DateInputBE value={field.value} onChange={field.onChange} id="start" />
 *     )}
 *   />
 *
 * Or as an uncontrolled wrapper around register():
 *   value={form.watch('start')}
 *   onChange={(v) => form.setValue('start', v, { shouldValidate: true })}
 */

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { normalizeBEInput } from '@/lib/date-be'

export interface DateInputBEProps {
  /** "DD/MM/YYYY" BE format string, or empty string */
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  /** Whether the field is in an error state (adds red border) */
  hasError?: boolean
}

export function DateInputBE({
  value = '',
  onChange,
  placeholder = 'วว/ดด/ปปปป',
  disabled = false,
  className,
  id,
  hasError = false,
}: DateInputBEProps) {
  // Local draft — what the user is actively typing
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // What to display in the input: while editing show draft; otherwise show committed value
  const displayValue = draft !== null ? draft : value

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value)
  }

  function handleBlur() {
    const raw = draft ?? value
    if (!raw.trim()) {
      // User cleared the field
      setDraft(null)
      onChange('')
      return
    }
    const normalized = normalizeBEInput(raw)
    setDraft(null)
    onChange(normalized)
  }

  function handleFocus() {
    // Start draft from the committed value so user edits in place
    setDraft(value)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      inputRef.current?.blur()
    }
  }

  return (
    <div className='relative flex items-center'>
      <input
        ref={inputRef}
        id={id}
        type='text'
        inputMode='numeric'
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete='off'
        spellCheck={false}
        className={cn(
          // Base — mirrors shadcn Input styles
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-14',
          'text-sm shadow-sm transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'font-mono',
          hasError && 'border-destructive focus-visible:ring-destructive',
          className,
        )}
        aria-invalid={hasError}
      />
      {/* พ.ศ. badge */}
      <span
        className={cn(
          'pointer-events-none absolute right-2.5 select-none',
          'rounded-sm bg-muted px-1 py-px text-[10px] font-semibold tracking-wide',
          'text-muted-foreground',
          disabled && 'opacity-50',
        )}
        aria-hidden
      >
        พ.ศ.
      </span>
    </div>
  )
}
