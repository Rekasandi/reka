"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "../lib/utils"
import { buttonVariants } from "./button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex justify-center pt-1 relative items-center text-sm font-medium",
        caption_label: "text-xs font-semibold text-foreground tracking-tight",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-xs" }),
          "absolute left-1 size-7 bg-transparent p-0 text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-xs" }),
          "absolute right-1 size-7 bg-transparent p-0 text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-x-1",
        weekdays: "flex justify-between",
        weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.75rem] text-center",
        week: "flex w-full mt-1.5 justify-between",
        day: "size-8 p-0 text-center text-xs relative [&:has([aria-selected])]:bg-accent/40 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal text-xs rounded-md aria-selected:opacity-100 hover:bg-secondary hover:text-foreground focus:bg-primary focus:text-primary-foreground"
        ),
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md font-medium",
        today: "bg-secondary/70 text-foreground font-semibold rounded-md",
        outside:
          "day-outside text-muted-foreground opacity-40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-30",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="size-4" />
          }
          return <ChevronRight className="size-4" />
        },
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
