"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu"

export interface DatePickerProps {
  date?: Date | null
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  disabled,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
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
      </DropdownMenuTrigger>
      <DropdownMenuContent
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
          initialFocus
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
