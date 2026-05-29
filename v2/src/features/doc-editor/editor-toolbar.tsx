/**
 * Full Word-like formatting toolbar for the document editor.
 * Driven entirely by TipTap editor commands; no local state except the
 * controlled Selects derive their value from the current selection.
 */
import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Type,
  Underline,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PLACEHOLDER_DEFS, type PlaceholderDef } from './placeholder-extension'

const TEXT_COLORS = [
  '#111111', '#dc2626', '#ea580c', '#ca8a04',
  '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777',
]
const HIGHLIGHTS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e9d5ff',
]
const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '28', '32']
const LINE_HEIGHTS = [
  { v: '1', label: '1.0' },
  { v: '1.15', label: '1.15' },
  { v: '1.5', label: '1.5' },
  { v: '2', label: '2.0' },
]

/** Icon toggle button. */
function TBtn({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Button
      type='button'
      size='sm'
      variant={active ? 'default' : 'ghost'}
      className='h-8 w-8 p-0'
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function Divider() {
  return <div className='mx-0.5 h-6 w-px shrink-0 bg-border' />
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const headingValue = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading', { level: 3 })
        ? 'h3'
        : 'p'

  const setBlock = (v: string) => {
    const c = editor.chain().focus()
    if (v === 'p') c.setParagraph().run()
    else c.setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run()
  }

  return (
    <div className='flex flex-wrap items-center gap-0.5 rounded-md border bg-card p-1.5'>
      {/* Block type */}
      <Select value={headingValue} onValueChange={setBlock}>
        <SelectTrigger className='h-8 w-[120px]' title='รูปแบบหัวข้อ'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='p'>ข้อความปกติ</SelectItem>
          <SelectItem value='h1'>หัวข้อใหญ่</SelectItem>
          <SelectItem value='h2'>หัวข้อกลาง</SelectItem>
          <SelectItem value='h3'>หัวข้อเล็ก</SelectItem>
        </SelectContent>
      </Select>

      {/* Font size */}
      <Select
        value=''
        onValueChange={(v) => editor.chain().focus().setFontSize(`${v}px`).run()}
      >
        <SelectTrigger className='h-8 w-[78px]' title='ขนาดตัวอักษร'>
          <SelectValue placeholder='ขนาด' />
        </SelectTrigger>
        <SelectContent>
          {FONT_SIZES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Divider />

      {/* Inline marks */}
      <TBtn
        title='ตัวหนา (Ctrl+B)'
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className='size-4' />
      </TBtn>
      <TBtn
        title='ตัวเอียง (Ctrl+I)'
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className='size-4' />
      </TBtn>
      <TBtn
        title='ขีดเส้นใต้ (Ctrl+U)'
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className='size-4' />
      </TBtn>
      <TBtn
        title='ขีดฆ่า'
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className='size-4' />
      </TBtn>

      {/* Text color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='h-8 gap-0 px-1.5'
            title='สีตัวอักษร'
          >
            <Type className='size-4' />
            <ChevronDown className='size-3 opacity-60' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-2'>
          <div className='grid grid-cols-5 gap-1'>
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type='button'
                title={c}
                className='size-6 rounded border'
                style={{ background: c }}
                onClick={() => editor.chain().focus().setColor(c).run()}
              />
            ))}
          </div>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='mt-2 h-7 w-full text-xs'
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            ลบสี
          </Button>
        </PopoverContent>
      </Popover>

      {/* Highlight */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='h-8 gap-0 px-1.5'
            title='สีไฮไลต์'
          >
            <Highlighter className='size-4' />
            <ChevronDown className='size-3 opacity-60' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-2'>
          <div className='grid grid-cols-3 gap-1'>
            {HIGHLIGHTS.map((c) => (
              <button
                key={c}
                type='button'
                title={c}
                className='size-6 rounded border'
                style={{ background: c }}
                onClick={() =>
                  editor.chain().focus().toggleHighlight({ color: c }).run()
                }
              />
            ))}
          </div>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='mt-2 h-7 w-full text-xs'
            onClick={() => editor.chain().focus().unsetHighlight().run()}
          >
            ลบไฮไลต์
          </Button>
        </PopoverContent>
      </Popover>

      <Divider />

      {/* Alignment (no justify — Thai text gets ugly spacing) */}
      <TBtn
        title='ชิดซ้าย'
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <AlignLeft className='size-4' />
      </TBtn>
      <TBtn
        title='กึ่งกลาง'
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter className='size-4' />
      </TBtn>
      <TBtn
        title='ชิดขวา'
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight className='size-4' />
      </TBtn>

      {/* Indent */}
      <TBtn title='เยื้องออก' onClick={() => editor.chain().focus().outdent().run()}>
        <IndentDecrease className='size-4' />
      </TBtn>
      <TBtn title='เยื้องเข้า' onClick={() => editor.chain().focus().indent().run()}>
        <IndentIncrease className='size-4' />
      </TBtn>

      {/* Line spacing */}
      <Select
        value=''
        onValueChange={(v) => editor.chain().focus().setLineHeight(v).run()}
      >
        <SelectTrigger className='h-8 w-[92px]' title='ระยะห่างบรรทัด'>
          <SelectValue placeholder='ระยะบรรทัด' />
        </SelectTrigger>
        <SelectContent>
          {LINE_HEIGHTS.map((l) => (
            <SelectItem key={l.v} value={l.v}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Divider />

      {/* Lists */}
      <TBtn
        title='หัวข้อย่อย (จุด)'
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className='size-4' />
      </TBtn>
      <TBtn
        title='หัวข้อย่อย (เลข)'
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className='size-4' />
      </TBtn>

      <Divider />

      {/* Insert: table, divider, data chips */}
      <TBtn
        title='แทรกตาราง'
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        <TableIcon className='size-4' />
      </TBtn>
      <TBtn
        title='เส้นคั่น'
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className='size-4' />
      </TBtn>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type='button'
            size='sm'
            variant='secondary'
            className='h-8 gap-1 px-2 text-xs'
            title='แทรกข้อมูลอัตโนมัติ'
          >
            แทรกข้อมูล
            <ChevronDown className='size-3 opacity-60' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-44 p-1'>
          {PLACEHOLDER_DEFS.map((def: PlaceholderDef) => (
            <button
              key={def.token}
              type='button'
              className={cn(
                'flex w-full items-center rounded px-2 py-1.5 text-left text-sm',
                'hover:bg-accent'
              )}
              onClick={() => editor.chain().focus().insertPlaceholder(def).run()}
            >
              {def.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Divider />

      {/* History */}
      <TBtn
        title='ย้อนกลับ (Ctrl+Z)'
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className='size-4' />
      </TBtn>
      <TBtn
        title='ทำซ้ำ (Ctrl+Y)'
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className='size-4' />
      </TBtn>
    </div>
  )
}
