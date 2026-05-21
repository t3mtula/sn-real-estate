import { Check, ChevronLeft, ChevronRight } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export interface FormStep {
  key: string
  label: string
  description?: string
  content: ReactNode
  /** return true (or resolve true) เพื่อให้ไป step ถัดไปได้ · ถ้า false = block */
  validate?: () => boolean | Promise<boolean>
}

interface FormStepperProps {
  steps: FormStep[]
  /** เริ่มที่ step ไหน (0-indexed) · default 0 */
  initialStep?: number
  /** กดปุ่ม Submit ที่ step สุดท้าย */
  onSubmit: () => void | Promise<void>
  submitLabel?: string
  className?: string
}

/**
 * FormStepper · multi-step wizard with progress indicator
 *
 * ใช้กับฟอร์มยาว (สัญญาเช่า · onboarding · multi-section form)
 * ลูกน้องเห็นว่าอยู่ขั้นไหน · เหลือกี่ขั้น
 */
export function FormStepper({
  steps,
  initialStep = 0,
  onSubmit,
  submitLabel = "บันทึก",
  className,
}: FormStepperProps) {
  const [current, setCurrent] = useState(initialStep)
  const [submitting, setSubmitting] = useState(false)

  const step = steps[current]
  const isFirst = current === 0
  const isLast = current === steps.length - 1

  if (!step) return null

  async function handleNext() {
    if (step?.validate) {
      const ok = await step.validate()
      if (!ok) return
    }
    setCurrent((c) => Math.min(c + 1, steps.length - 1))
  }

  function handlePrev() {
    setCurrent((c) => Math.max(c - 1, 0))
  }

  async function handleSubmit() {
    if (step?.validate) {
      const ok = await step.validate()
      if (!ok) return
    }
    setSubmitting(true)
    try {
      await onSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Progress indicator */}
      <nav aria-label="Form steps">
        <ol className="flex items-start">
          {steps.map((s, i) => {
            const isDone = i < current
            const isCurrent = i === current
            return (
              <li key={s.key} className={cn("flex flex-1 items-start", i > 0 && "min-w-0")}>
                {i > 0 && (
                  <div
                    className={cn(
                      "mt-4 h-0.5 flex-1",
                      isDone || isCurrent ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <div className="flex flex-col items-center text-center px-2 min-w-0">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                      isDone && "border-primary bg-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary",
                      !isDone && !isCurrent && "border-border text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="size-4" /> : i + 1}
                  </div>
                  <div className="mt-1.5 max-w-[8rem] text-xs">
                    <div
                      className={cn(
                        "truncate font-medium",
                        isCurrent ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </nav>

      <Separator />

      {/* Step content */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{step.label}</h2>
          {step.description && (
            <p className="text-sm text-muted-foreground">{step.description}</p>
          )}
        </div>
        {step.content}
      </div>

      {/* Navigation */}
      <div className="flex justify-between border-t pt-4">
        <Button type="button" variant="outline" onClick={handlePrev} disabled={isFirst || submitting}>
          <ChevronLeft className="size-4" />
          <span className="ml-1">ย้อนกลับ</span>
        </Button>
        {isLast ? (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "กำลังบันทึก..." : submitLabel}
          </Button>
        ) : (
          <Button type="button" onClick={handleNext} disabled={submitting}>
            <span className="mr-1">ถัดไป</span>
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
