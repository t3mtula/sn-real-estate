import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * SortableList · drag-reorder generic list
 *
 * Touch + keyboard + a11y พร้อมใช้ (จาก @dnd-kit)
 *
 * Usage:
 *   <SortableList
 *     items={customers}
 *     getId={(c) => c.id}
 *     onReorder={(ids) => reorder.mutate(ids)}
 *     renderItem={(c) => <div>{c.name}</div>}
 *   />
 *
 * Drag handle เป็น icon ⋮ ก่อนเนื้อหา · กดที่ icon เท่านั้นถึงจะ drag (กัน mis-click)
 */

interface SortableListProps<T> {
  items: T[]
  getId: (item: T) => string | number
  onReorder: (newOrderIds: (string | number)[]) => void
  renderItem: (item: T, index: number) => ReactNode
  className?: string
  itemClassName?: string
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  className,
  itemClassName,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((it) => String(getId(it)) === String(active.id))
    const newIndex = items.findIndex((it) => String(getId(it)) === String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(items, oldIndex, newIndex)
    onReorder(reordered.map((it) => getId(it)))
  }

  const ids = items.map((it) => String(getId(it)))

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={cn('flex flex-col gap-1', className)}>
          {items.map((item, index) => (
            <SortableRow
              key={String(getId(item))}
              id={String(getId(item))}
              className={itemClassName}
            >
              {renderItem(item, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-card px-3 py-2',
        isDragging && 'opacity-50 ring-2 ring-primary',
        className,
      )}
    >
      <button
        type='button'
        className='cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing'
        aria-label='ลากเพื่อเรียงลำดับ'
        {...attributes}
        {...listeners}
      >
        <GripVertical className='size-4' />
      </button>
      <div className='flex-1'>{children}</div>
    </li>
  )
}
