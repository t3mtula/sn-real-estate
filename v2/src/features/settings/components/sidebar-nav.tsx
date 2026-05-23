import { useState, type JSX } from 'react'
import { useLocation, useNavigate, Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SidebarNavItem = {
  href: string
  title: string
  icon: JSX.Element
}

export type SidebarNavGroup = {
  label: string
  items: SidebarNavItem[]
}

type SidebarNavProps = React.HTMLAttributes<HTMLElement> & {
  groups: SidebarNavGroup[]
}

export function SidebarNav({ className, groups, ...props }: SidebarNavProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [val, setVal] = useState(pathname ?? '/settings')

  const handleSelect = (e: string) => {
    setVal(e)
    navigate({ to: e })
  }

  return (
    <>
      <div className='p-1 md:hidden'>
        <Select value={val} onValueChange={handleSelect}>
          <SelectTrigger className='h-12 sm:w-48'>
            <SelectValue placeholder='เลือกหมวด' />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.items.map((item) => (
                  <SelectItem key={item.href} value={item.href}>
                    <div className='flex gap-x-3 px-1 py-0.5'>
                      <span className='scale-110'>{item.icon}</span>
                      <span>{item.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea
        orientation='horizontal'
        type='always'
        className='hidden w-full min-w-40 bg-background px-1 py-2 md:block'
      >
        <nav
          className={cn('flex flex-col gap-4 py-1', className)}
          {...props}
        >
          {groups.map((group) => (
            <div key={group.label} className='flex flex-col gap-1'>
              <p className='px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
                {group.label}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    buttonVariants({ variant: 'ghost' }),
                    pathname === item.href
                      ? 'bg-muted hover:bg-accent'
                      : 'hover:bg-accent',
                    'justify-start'
                  )}
                >
                  <span className='me-2'>{item.icon}</span>
                  {item.title}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>
    </>
  )
}
