"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/lib/utils"

const Select = ({ children, onValueChange, defaultValue, value }: { children: React.ReactNode, onValueChange?: (value: string) => void, defaultValue?: string, value?: string }) => {
  const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || "")

  React.useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
    }
  }, [value])

  const handleSelect = (val: string) => {
    setSelectedValue(val)
    onValueChange?.(val)
  }

  // Pass context to children
  return (
    <SelectContext.Provider value={{ selectedValue, handleSelect }}>
      <DropdownMenuPrimitive.Root>
        {children}
      </DropdownMenuPrimitive.Root>
    </SelectContext.Provider>
  )
}

const SelectContext = React.createContext<{ selectedValue: string; handleSelect: (val: string) => void }>({ selectedValue: "", handleSelect: () => { } })

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown className="h-4 w-4 opacity-50" />
  </DropdownMenuPrimitive.Trigger>
))
SelectTrigger.displayName = "SelectTrigger"

const SelectContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      <div className="p-1">{children}</div>
    </DropdownMenuPrimitive.Content>
  </DropdownMenuPrimitive.Portal>
))
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { value: string }
>(({ className, children, value, ...props }, ref) => {
  const { selectedValue, handleSelect } = React.useContext(SelectContext)
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      onSelect={() => handleSelect(value)}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {selectedValue === value && <Check className="h-4 w-4" />}
      </span>
      <span className="truncate">{children}</span>
    </DropdownMenuPrimitive.Item>
  )
})
SelectItem.displayName = "SelectItem"

const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const { selectedValue } = React.useContext(SelectContext)
  // This is a simplification. Ideally mapping value to label requires more complex context or children traversal.
  // For now, we rely on the parent updating or just showing value.
  // Actually, to show the label corresponding to the value, we need a map.
  // BUT, for standard Select usage, consumers usually construct <SelectValue />.
  // Let's just render children or selectedValue if straightforward.
  // If we want "Label" display, we might need a workaround since Dropdown doesn't have native "Select" semantics.
  // A specific limitation of this workaround: it might just show the value string if we don't pass labels map.
  // Let's assume for now value is sufficient or acceptable, OR we can try to improve if needed.
  // Actually, let's keep it simple: "SelectValue" just renders a span, content is controlled by the user via SelectTrigger children usually in Radix Select.
  // In Radix Select, SelectValue automatically reflects selected item's text.
  // Since we are mocking with Dropdown, we might miss that auto-text feature.
  // Let's accept this limitation for now or fetch label from children (hard).
  // Better: let the user pass the display text to SelectTrigger directly for now if they use this.
  // Or we stick to a simpler "Value" display.
  return <span className="pointer-events-none">{selectedValue || placeholder}</span>
}

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
