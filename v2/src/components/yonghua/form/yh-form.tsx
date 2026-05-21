import { zodResolver } from '@hookform/resolvers/zod'
import { type ReactNode } from 'react'
import {
  type DefaultValues,
  FormProvider,
  type UseFormReturn,
  useForm,
} from 'react-hook-form'
import { type z } from 'zod'
import { Form } from '@/components/ui/form'

/**
 * YhForm · typed RHF + Zod wrapper · จัด 3-generic ที่เพี้ยนเอง
 *
 * แก้ปัญหา z.coerce.number() ที่ input type = unknown · output type = number
 * → ใช้ useForm<z.input<S>, unknown, z.output<S>> ทุกครั้ง
 *
 * Usage:
 *   const schema = z.object({ name: z.string(), age: z.coerce.number() })
 *
 *   <YhForm
 *     schema={schema}
 *     defaultValues={{ name: "", age: 0 }}
 *     onSubmit={async (values) => { ... }} // values: { name: string, age: number }
 *   >
 *     {(form) => (
 *       <>
 *         <FormField control={form.control} name="name" ... />
 *         <NumberField control={form.control} name="age" label="อายุ" />
 *       </>
 *     )}
 *   </YhForm>
 *
 * Children เป็น render-prop รับ `form` (typed) · หรือเป็น JSX ตรงๆ (ใช้ useFormContext)
 */

// biome-ignore lint/suspicious/noExplicitAny: zod type inference
type AnySchema = z.ZodType<any, any>

type FormInstance<S extends AnySchema> = UseFormReturn<z.input<S>, unknown, z.output<S>>

interface YhFormProps<S extends AnySchema> {
  schema: S
  defaultValues: DefaultValues<z.input<S>>
  onSubmit: (values: z.output<S>) => void | Promise<void>
  children: ReactNode | ((form: FormInstance<S>) => ReactNode)
  className?: string
}

export function YhForm<S extends AnySchema>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
}: YhFormProps<S>) {
  const form = useForm<z.input<S>, unknown, z.output<S>>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={className}
        >
          {typeof children === 'function' ? children(form) : children}
        </form>
      </Form>
    </FormProvider>
  )
}
