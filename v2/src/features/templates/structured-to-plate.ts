/**
 * Seed a Plate document from a template's existing structured fields
 * (name / intro / clauses[] / closing). Used the first time a template is
 * opened in the new <DocEditor> so it isn't blank — the structured data is
 * left untouched (the doc is stored additively).
 *
 * Best-effort migration: HTML tags in the legacy text are stripped to plain
 * text; {{placeholders}} are kept literal (staff can replace them with chips).
 */
import type { Value } from 'platejs'
import type { TemplateData } from './types'

function stripHtml(s: string): string {
  return (s ?? '').replace(/<[^>]+>/g, '').trim()
}

/** Split a multi-line legacy string into paragraph nodes. */
function paragraphs(text: string): Value {
  const lines = stripHtml(text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
  return lines.map((line) => ({ type: 'p', children: [{ text: line }] }))
}

export function structuredToPlate(data: TemplateData): Value {
  const nodes: Value = []

  nodes.push({
    type: 'h1',
    align: 'center',
    children: [{ text: data.name?.trim() || 'สัญญาเช่า' }],
  })

  nodes.push(...paragraphs(data.intro))

  ;(data.clauses ?? []).forEach((clause, i) => {
    nodes.push({
      type: 'p',
      children: [
        { text: `ข้อ ${i + 1}. `, bold: true },
        { text: stripHtml(clause.text) },
      ],
    })
    ;(clause.sub ?? []).forEach((sub) => {
      const t = stripHtml(sub)
      if (!t) return
      // Plate list = indented block with a list style (renders a bullet)
      nodes.push({
        type: 'p',
        indent: 1,
        listStyleType: 'disc',
        children: [{ text: t }],
      })
    })
  })

  nodes.push(...paragraphs(data.closing))

  if (nodes.length === 0) nodes.push({ type: 'p', children: [{ text: '' }] })
  return nodes
}
