"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

export interface DatePickerProps {
  date?: Date | null
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
  id?: string
  "aria-label"?: string
}

/** Parse a `YYYY-MM-DD` string as a local calendar date (no timezone shift). */
export function parseDateOnly(value?: string | null): Date | undefined {
  if (!value) return undefined
  const [y, m, d] = value.slice(0, 10).split("-").map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}

/** Format a local calendar date as `YYYY-MM-DD`. */
export function toDateOnly(date?: Date | null): string {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  disabled,
  clearable = true,
  id,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-start text-left font-normal text-xs px-2.5 rounded-[6px] border-border/70 bg-background/90 hover:bg-secondary/40",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate flex-1">
            {date ? format(date, "PPP") : placeholder}
          </span>
          {clearable && date && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onDateChange?.(undefined)
              }}
              className="ml-auto p-0.5 rounded-[4px] hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0 bg-popover border border-border shadow-2xl rounded-[12px]"
      >
        <Calendar
          mode="single"
          selected={date || undefined}
          onSelect={(selected) => {
            onDateChange?.(selected)
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
