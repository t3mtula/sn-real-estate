/**
 * Document editor toolbar — assembled from Plate's official, tested toolbar
 * buttons. Behaviour (lists, tables, indent, alignment, fonts) lives in the
 * plugins (see plate-kit.ts); these buttons just trigger the commands.
 */
import { KEYS } from 'platejs'
import { useEditorRef } from 'platejs/react'
import {
  Baseline,
  Bold,
  ChevronDown,
  Italic,
  PaintBucket,
  Strikethrough,
  Underline,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Toolbar, ToolbarButton, ToolbarSeparator } from '@/components/ui/toolbar'
import { MarkToolbarButton } from '@/components/ui/mark-toolbar-button'
import {
  BulletedListToolbarButton,
  NumberedListToolbarButton,
} from '@/components/ui/list-toolbar-button'
import { AlignToolbarButton } from '@/components/ui/align-toolbar-button'
import { FontSizeToolbarButton } from '@/components/ui/font-size-toolbar-button'
import { FontColorToolbarButton } from '@/components/ui/font-color-toolbar-button'
import {
  IndentToolbarButton,
  OutdentToolbarButton,
} from '@/components/ui/indent-toolbar-button'
import { LineHeightToolbarButton } from '@/components/ui/line-height-toolbar-button'
import { DOC_FIELDS } from './doc-fields'

export function DocToolbar() {
  const editor = useEditorRef()

  /** Insert an auto-fill chip (mention element) for the chosen field. */
  const insertField = (label: string) => {
    editor.tf.focus()
    editor.tf.insertNodes({
      type: KEYS.mention,
      value: label,
      children: [{ text: '' }],
    })
  }

  return (
    <Toolbar className='flex flex-wrap items-center gap-0.5 rounded-md border bg-card p-1'>
      {/* Block type */}
      <Select
        value=''
        onValueChange={(v) => editor.tf.toggleBlock(v)}
      >
        <SelectTrigger className='h-8 w-[120px]' title='รูปแบบหัวข้อ'>
          <SelectValue placeholder='หัวข้อ' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='p'>ข้อความปกติ</SelectItem>
          <SelectItem value='h1'>หัวข้อใหญ่</SelectItem>
          <SelectItem value='h2'>หัวข้อกลาง</SelectItem>
          <SelectItem value='h3'>หัวข้อเล็ก</SelectItem>
        </SelectContent>
      </Select>

      <FontSizeToolbarButton />

      <ToolbarSeparator />

      <MarkToolbarButton nodeType='bold' tooltip='ตัวหนา (Ctrl+B)'>
        <Bold />
      </MarkToolbarButton>
      <MarkToolbarButton nodeType='italic' tooltip='ตัวเอียง (Ctrl+I)'>
        <Italic />
      </MarkToolbarButton>
      <MarkToolbarButton nodeType='underline' tooltip='ขีดเส้นใต้ (Ctrl+U)'>
        <Underline />
      </MarkToolbarButton>
      <MarkToolbarButton nodeType='strikethrough' tooltip='ขีดฆ่า'>
        <Strikethrough />
      </MarkToolbarButton>

      <FontColorToolbarButton nodeType='color' tooltip='สีตัวอักษร'>
        <Baseline />
      </FontColorToolbarButton>
      <FontColorToolbarButton nodeType='backgroundColor' tooltip='สีไฮไลต์'>
        <PaintBucket />
      </FontColorToolbarButton>

      <ToolbarSeparator />

      <AlignToolbarButton />
      <OutdentToolbarButton />
      <IndentToolbarButton />
      <LineHeightToolbarButton />

      <ToolbarSeparator />

      <BulletedListToolbarButton />
      <NumberedListToolbarButton />

      <ToolbarSeparator />

      {/* Insert auto-fill data chip */}
      <Popover>
        <PopoverTrigger asChild>
          <ToolbarButton tooltip='แทรกข้อมูลอัตโนมัติ' className='w-auto gap-1 px-2'>
            แทรกข้อมูล
            <ChevronDown className='size-3 opacity-60' />
          </ToolbarButton>
        </PopoverTrigger>
        <PopoverContent
          align='start'
          className='w-48 p-1'
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {DOC_FIELDS.map((f) => (
            <button
              key={f.key}
              type='button'
              className='flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent'
              onClick={() => insertField(f.label)}
            >
              {f.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </Toolbar>
  )
}
