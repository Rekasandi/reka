import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const fieldVariants = cva("group/field flex flex-col gap-1.5", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row items-center justify-between gap-3",
      responsive: "flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-3",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
})

function Field({
  className,
  orientation,
  "data-invalid": dataInvalid,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> & {
    "data-invalid"?: boolean
  }) {
  return (
    <div
      role="group"
      data-slot="field"
      data-invalid={dataInvalid}
      className={cn(
        fieldVariants({ orientation }),
        dataInvalid && "[&_[data-slot=field-label]]:text-destructive",
        className
      )}
      {...props}
    />
  )
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="fieldset"
      className={cn("flex flex-col gap-4 border-none p-0 m-0", className)}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & {
  variant?: "legend" | "label"
}) {
  return (
    <legend
      data-slot="field-legend"
      className={cn(
        variant === "legend"
          ? "text-sm font-semibold text-foreground tracking-tight"
          : "text-xs font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex flex-col gap-3.5", className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "text-xs font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-[11px] text-muted-foreground leading-normal", className)}
      {...props}
    />
  )
}

function FieldError({
  className,
  errors,
  children,
  ...props
}: React.ComponentProps<"p"> & {
  errors?: (string | { message?: string } | undefined)[]
}) {
  const content =
    children ||
    (errors && errors.length > 0
      ? errors
          .map((err) => (typeof err === "string" ? err : err?.message))
          .filter(Boolean)
          .join(", ")
      : null)

  if (!content) return null

  return (
    <p
      data-slot="field-error"
      className={cn("text-[11px] font-medium text-destructive", className)}
      {...props}
    >
      {content}
    </p>
  )
}

export {
  Field,
  FieldSet,
  FieldLegend,
  FieldGroup,
  FieldContent,
  FieldLabel,
  FieldDescription,
  FieldError,
}
