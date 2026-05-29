/**
 * Plugin set for the document editor — composed from Plate's official kits
 * (installed via `npx shadcn add <kit>` from the Plate registry). Each kit
 * bundles the plugin + its tested Plate-UI components, so lists / tables /
 * indent / alignment / fonts all work out of the box (no hand-wired toolbar).
 *
 * Note: ListKit already pulls in IndentKit, so we don't add IndentKit again.
 */
import { AlignKit } from '@/components/editor/plugins/align-kit'
import { BasicNodesKit } from '@/components/editor/plugins/basic-nodes-kit'
import { FontKit } from '@/components/editor/plugins/font-kit'
import { LineHeightKit } from '@/components/editor/plugins/line-height-kit'
import { ListKit } from '@/components/editor/plugins/list-kit'
import { MentionKit } from '@/components/editor/plugins/mention-kit'

export const DocPlateKit = [
  ...BasicNodesKit, // headings, blockquote, hr, bold/italic/underline/strike/code…
  ...FontKit, // font size, text colour, highlight (background colour)
  ...AlignKit, // text alignment
  ...LineHeightKit, // line spacing
  ...ListKit, // bullet / numbered lists (+ IndentKit for เยื้องย่อหน้า)
  ...MentionKit, // auto-fill data chips (ชิปข้อมูล) — type "@" or use the toolbar
]
