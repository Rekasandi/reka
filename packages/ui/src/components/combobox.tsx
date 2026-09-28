import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "../lib/utils"

function Combobox<Item, Multiple extends boolean = false>(
  props: React.ComponentProps<typeof ComboboxPrimitive.Root<Item, Multiple>>
) {
  return <ComboboxPrimitive.Root data-slot="combobox" {...props} />
}

function ComboboxInput({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono",
        className
      )}
      {...props}
    />
  )
}

function ComboboxContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Popup> & {
  sideOffset?: number
}) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner sideOffset={sideOffset} className="z-50">
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "min-w-(--anchor-width) max-h-60 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg transition-all focus:outline-none",
            className
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList(
  props: React.ComponentProps<typeof ComboboxPrimitive.List>
) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className="flex flex-col gap-0.5"
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Item>) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center justify-between rounded-md px-2.5 py-1.5 text-xs outline-none transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className="flex-1 truncate">{children}</span>
      <ComboboxPrimitive.ItemIndicator className="ml-2 shrink-0">
        <Check className="size-3.5 text-foreground" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxEmpty({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("p-3 text-center text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function ComboboxGroup({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Group>) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn("py-1", className)}
      {...props}
    />
  )
}

function ComboboxLabel({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.GroupLabel>) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn(
        "px-2 py-1 text-xs font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function ComboboxSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Separator>) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxSeparator,
}
