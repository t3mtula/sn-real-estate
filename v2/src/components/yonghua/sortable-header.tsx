import { type Column } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Sortable column header — wrap shadcn Button + lucide arrow icon
 *
 * Usage:
 *   header: ({ column }) => <SortableHeader column={column}>ชื่อ</SortableHeader>
 */
export function SortableHeader<TData, TValue>({
  column,
  children,
}: {
  column: Column<TData, TValue>
  children: React.ReactNode
}) {
  const sorted = column.getIsSorted()
  const Icon =
    sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
  return (
    <Button
      variant='ghost'
      size='sm'
      className='-ml-2 h-8 px-2 hover:bg-muted/60'
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {children}
      <Icon
        className={
          sorted
            ? 'ml-1.5 size-3.5 text-foreground'
            : 'ml-1.5 size-3.5 text-muted-foreground/70'
        }
      />
    </Button>
  )
}
