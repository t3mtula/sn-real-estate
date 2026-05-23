import React, { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  Building2,
  ChevronRight,
  FileText,
  Laptop,
  Moon,
  Receipt,
  Sun,
  Users,
} from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import { useContracts } from '@/features/contracts/queries'
import { useInvoices } from '@/features/invoices/queries'
import { useProperties } from '@/features/properties/queries'
import { useTenants } from '@/features/tenants/queries'
import { useLandlords } from '@/features/landlords/queries'
import { useBankAccounts } from '@/features/bank-accounts/queries'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

const MAX_RESULTS = 8

function matches(haystack: (string | undefined | null)[], needle: string): boolean {
  const n = needle.toLowerCase()
  return haystack.some((s) => s?.toLowerCase().includes(n))
}

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const [query, setQuery] = useState('')

  const { data: contracts } = useContracts()
  const { data: invoices } = useInvoices()
  const { data: properties } = useProperties()
  const { data: tenants } = useTenants()
  const { data: landlords } = useLandlords()
  const { data: bankAccounts } = useBankAccounts()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      setQuery('')
      command()
    },
    [setOpen],
  )

  const q = query.trim()

  const filteredContracts = useMemo(() => {
    if (!q || !contracts) return []
    return contracts
      .filter((c) => matches([c.data?.no as string, c.data?.tenant as string, c.data?.property as string], q))
      .slice(0, MAX_RESULTS)
  }, [q, contracts])

  const filteredInvoices = useMemo(() => {
    if (!q || !invoices) return []
    return invoices
      .filter((i) => matches([i.data?.invoiceNo, i.data?.tenant, i.data?.property], q))
      .slice(0, MAX_RESULTS)
  }, [q, invoices])

  const filteredProperties = useMemo(() => {
    if (!q || !properties) return []
    return properties
      .filter((p) => matches([p.data?.name, p.data?.address, p.data?.titleDeed], q))
      .slice(0, MAX_RESULTS)
  }, [q, properties])

  const filteredTenants = useMemo(() => {
    if (!q || !tenants) return []
    return tenants
      .filter((t) => matches([t.data?.name, t.data?.taxId, t.data?.phone], q))
      .slice(0, MAX_RESULTS)
  }, [q, tenants])

  const filteredLandlords = useMemo(() => {
    if (!q || !landlords) return []
    return landlords
      .filter((l) => matches([l.data?.name, l.data?.shortName, l.data?.taxId, l.data?.phone], q))
      .slice(0, MAX_RESULTS)
  }, [q, landlords])

  const filteredBanks = useMemo(() => {
    if (!q || !bankAccounts) return []
    return bankAccounts
      .filter((b) => matches([b.data?.bank, b.data?.acctNo, b.data?.accountName, b.data?.label], q))
      .slice(0, MAX_RESULTS)
  }, [q, bankAccounts])

  const hasResults =
    filteredContracts.length + filteredInvoices.length +
    filteredProperties.length + filteredTenants.length +
    filteredLandlords.length + filteredBanks.length > 0

  return (
    <CommandDialog modal open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery('') }}>
      <CommandInput
        placeholder='ค้นหาสัญญา · ใบแจ้งหนี้ · ทรัพย์สิน · ผู้เช่า · ผู้ให้เช่า · บัญชี…'
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <ScrollArea type='hover' className='h-[480px] pe-1'>
          {q && !hasResults && <CommandEmpty>ไม่พบผลการค้นหา</CommandEmpty>}

          {filteredContracts.length > 0 && (
            <CommandGroup heading='📋 สัญญา'>
              {filteredContracts.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`contract-${c.id}`}
                  onSelect={() => runCommand(() => navigate({ to: '/contracts/$id', params: { id: c.id } }))}
                >
                  <FileText className='size-4 text-muted-foreground' />
                  <div className='flex-1 min-w-0'>
                    <span className='font-medium'>{c.data?.no || c.id.slice(0, 8)}</span>
                    <span className='ml-2 text-xs text-muted-foreground truncate'>{String(c.data?.tenant ?? '')} · {String(c.data?.property ?? '')}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredInvoices.length > 0 && (
            <CommandGroup heading='💰 ใบแจ้งหนี้'>
              {filteredInvoices.map((inv) => (
                <CommandItem
                  key={inv.id}
                  value={`invoice-${inv.id}`}
                  onSelect={() => runCommand(() => navigate({ to: '/invoices/$id', params: { id: inv.id } }))}
                >
                  <Receipt className='size-4 text-muted-foreground' />
                  <div className='flex-1 min-w-0'>
                    <span className='font-medium'>{inv.data?.invoiceNo || '—'}</span>
                    <span className='ml-2 text-xs text-muted-foreground truncate'>{inv.data?.tenant} · {inv.data?.property}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredProperties.length > 0 && (
            <CommandGroup heading='🏢 ทรัพย์สิน'>
              {filteredProperties.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`property-${p.id}`}
                  onSelect={() => runCommand(() => navigate({ to: '/properties/$id', params: { id: p.id } }))}
                >
                  <Building2 className='size-4 text-muted-foreground' />
                  <span>{p.data?.name || '—'}</span>
                  {p.data?.address && (
                    <span className='ml-2 text-xs text-muted-foreground truncate'>{p.data.address}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredTenants.length > 0 && (
            <CommandGroup heading='👤 ผู้เช่า'>
              {filteredTenants.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`tenant-${t.id}`}
                  onSelect={() => runCommand(() => navigate({ to: '/tenants/$id', params: { id: t.id } }))}
                >
                  <Users className='size-4 text-muted-foreground' />
                  <span>{t.data?.name || '—'}</span>
                  {t.data?.taxId && (
                    <span className='ml-2 text-xs text-muted-foreground'>{t.data.taxId}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredLandlords.length > 0 && (
            <CommandGroup heading='🏛 ผู้ให้เช่า'>
              {filteredLandlords.map((l) => (
                <CommandItem
                  key={l.id}
                  value={`landlord-${l.id}`}
                  onSelect={() => runCommand(() => navigate({ to: '/landlords/$id', params: { id: l.id } }))}
                >
                  <Building2 className='size-4 text-muted-foreground' />
                  <span>{l.data?.name || '—'}</span>
                  {l.data?.taxId && (
                    <span className='ml-2 text-xs text-muted-foreground'>{l.data.taxId}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredBanks.length > 0 && (
            <CommandGroup heading='🏦 บัญชีธนาคาร'>
              {filteredBanks.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`bank-${b.id}`}
                  onSelect={() => runCommand(() => navigate({ to: '/bank-accounts/$id', params: { id: b.id } }))}
                >
                  <Receipt className='size-4 text-muted-foreground' />
                  <div className='flex-1 min-w-0'>
                    <span className='font-medium'>{b.data?.bank ?? '—'} · {b.data?.acctNo ?? ''}</span>
                    <span className='ml-2 text-xs text-muted-foreground truncate'>{b.data?.accountName ?? ''}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!q && (
            <>
              {sidebarData.navGroups.map((group) => (
                <CommandGroup key={group.title} heading={group.title}>
                  {group.items.map((navItem, i) => {
                    if (navItem.url)
                      return (
                        <CommandItem
                          key={`${navItem.url}-${i}`}
                          value={navItem.title}
                          onSelect={() => runCommand(() => navigate({ to: navItem.url }))}
                        >
                          <ArrowRight className='size-3.5 text-muted-foreground/80' />
                          {navItem.title}
                        </CommandItem>
                      )
                    return navItem.items?.map((subItem, j) => (
                      <CommandItem
                        key={`${navItem.title}-${subItem.url}-${j}`}
                        value={`${navItem.title}-${subItem.url}`}
                        onSelect={() => runCommand(() => navigate({ to: subItem.url }))}
                      >
                        <ArrowRight className='size-3.5 text-muted-foreground/80' />
                        {navItem.title} <ChevronRight className='size-3' /> {subItem.title}
                      </CommandItem>
                    ))
                  })}
                </CommandGroup>
              ))}
              <CommandSeparator />
              <CommandGroup heading='ธีม'>
                <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
                  <Sun className='size-4' /><span>สว่าง</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
                  <Moon className='size-4' /><span>มืด</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
                  <Laptop className='size-4' /><span>ตามระบบ</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
