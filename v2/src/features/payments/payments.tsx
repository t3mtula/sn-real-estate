import { Link, useNavigate } from '@tanstack/react-router'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Banknote, CircleCheck, CircleDot, CircleHelp, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SortableHeader } from '@/components/yonghua/sortable-header'
import { useContracts } from '@/features/contracts/queries'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import { amt } from '@/lib/thai'
import { cn } from '@/lib/utils'
import { usePayments } from './queries'
import type { Payment } from './types'
import { PAY_METHOD_LABELS } from './schema'

const STATUS_CONFIG = {
  matched:     { label: 'จับคู่แล้ว',     icon: CircleCheck, cls: 'text-green-600 dark:text-green-400' },
  partial:     { label: 'บางส่วน',        icon: CircleDot,   cls: 'text-amber-600 dark:text-amber-400' },
  unallocated: { label: 'ยังไม่จับคู่',   icon: CircleHelp,  cls: 'text-muted-foreground' },
}

export function Payments() {
  const { data: payments, isLoading, error } = usePayments()
  const { data: contracts } = useContracts()
  const { data: bankAccounts } = useBankAccounts()
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const navigate = useNavigate()

  const contractMap = new Map((contracts ?? []).map((c) => [c.id, c]))
  const bankMap = new Map((bankAccounts ?? []).map((b) => [b.id, b]))

  const columns: ColumnDef<Payment>[] = [
    {
      id: 'receiptNo',
      header: ({ column }) => <SortableHeader column={column}>เลขใบเสร็จ</SortableHeader>,
      accessorFn: (r) => r.data?.receiptNo ?? r.id,
      cell: ({ row }) => (
        <span className='font-mono text-sm font-medium'>
          {row.original.data?.receiptNo ?? '—'}
        </span>
      ),
    },
    {
      id: 'date',
      header: ({ column }) => <SortableHeader column={column}>วันที่รับ</SortableHeader>,
      accessorFn: (r) => r.data?.date ?? '',
      cell: ({ row }) => <span className='text-sm'>{row.original.data?.date ?? '—'}</span>,
    },
    {
      id: 'contract',
      header: 'สัญญา',
      accessorFn: (r) => {
        const c = contractMap.get(r.data?.contract_id ?? '')
        return c?.data?.no ?? r.data?.contract_id ?? ''
      },
      cell: ({ row }) => {
        const c = contractMap.get(row.original.data?.contract_id ?? '')
        if (!c) return <span className='text-muted-foreground text-sm'>—</span>
        return (
          <Link to='/contracts/$id' params={{ id: c.id }} className='text-sm text-primary hover:underline'>
            {c.data?.no}
          </Link>
        )
      },
    },
    {
      id: 'bankAccount',
      header: 'บัญชีรับเงิน',
      accessorFn: (r) => {
        const b = bankMap.get(r.data?.bank_account_id ?? '')
        return b?.data?.accountName ?? ''
      },
      cell: ({ row }) => {
        const b = bankMap.get(row.original.data?.bank_account_id ?? '')
        if (!b) return <span className='text-muted-foreground text-sm'>—</span>
        return (
          <div className='text-sm'>
            <span className='font-medium'>{b.data?.bank}</span>
            <span className='text-muted-foreground ml-1'>{b.data?.acctNo}</span>
          </div>
        )
      },
    },
    {
      id: 'payerName',
      header: 'ผู้โอน',
      accessorFn: (r) => r.data?.payerName ?? '',
      cell: ({ row }) => (
        <span className='text-sm'>{row.original.data?.payerName || '—'}</span>
      ),
    },
    {
      id: 'payMethod',
      header: 'วิธีชำระ',
      accessorFn: (r) => r.data?.payMethod ?? '',
      cell: ({ row }) => (
        <span className='text-sm'>{PAY_METHOD_LABELS[row.original.data?.payMethod ?? ''] ?? '—'}</span>
      ),
    },
    {
      id: 'amount',
      header: ({ column }) => <SortableHeader column={column} className='text-right'>ยอดรับ</SortableHeader>,
      accessorFn: (r) => Number(r.data?.amount ?? 0),
      cell: ({ row }) => (
        <div className='text-right font-semibold text-sm'>
          {amt(Number(row.original.data?.amount ?? 0), { decimal: 0 })}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'สถานะ',
      accessorFn: (r) => r.data?.status ?? 'unallocated',
      cell: ({ row }) => {
        const st = row.original.data?.status ?? 'unallocated'
        const cfg = STATUS_CONFIG[st as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.unallocated
        const Icon = cfg.icon
        return (
          <div className={cn('flex items-center gap-1.5 text-sm', cfg.cls)}>
            <Icon className='size-3.5 shrink-0' />
            <span>{cfg.label}</span>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: payments ?? [],
    columns,
    state: { globalFilter, sorting },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const total = (payments ?? []).reduce((s, p) => s + Number(p.data?.amount ?? 0), 0)

  return (
    <>
      <Header fixed>
        <div className='ms-auto flex items-center gap-2'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>รับเงิน</h1>
            <p className='text-muted-foreground text-sm'>
              {isLoading ? '…' : `${payments?.length ?? 0} รายการ · รวม ${amt(total, { decimal: 0 })} บาท`}
            </p>
          </div>
          <Button asChild size='sm'>
            <Link to='/payments/new'>
              <Plus className='size-4' />
              บันทึกรับเงิน
            </Link>
          </Button>
        </div>

        <div className='flex items-center gap-2'>
          <div className='relative flex-1 max-w-sm'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
            <Input
              placeholder='ค้นหา เลขใบเสร็จ / ผู้โอน / สัญญา…'
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className='pl-9'
            />
          </div>
        </div>

        {error ? (
          <p className='text-destructive text-sm'>โหลดข้อมูลไม่สำเร็จ</p>
        ) : isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        ) : (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id}>
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className='h-32 text-center'>
                      <div className='flex flex-col items-center gap-2 text-muted-foreground'>
                        <Banknote className='size-8 opacity-30' />
                        <p className='text-sm'>ยังไม่มีรายการรับเงิน</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className='cursor-pointer hover:bg-muted/50'
                      onClick={() => navigate({ to: '/payments/$id', params: { id: row.original.id } })}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Main>
    </>
  )
}
