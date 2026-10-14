import * as React from 'react';
import {
  Badge, cn, DropdownMenu, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuShortcut,
} from '@reka/ui';
import { AlertCircle, SignalHigh, SignalMedium, SignalLow, Minus } from 'lucide-react';
import { IssuePickerMenu } from './issue-picker-menu';

export const PRIORITY_CONFIG = [
  { key: 'urgent', label: 'Urgent', number: 1 },
  { key: 'high', label: 'High', number: 2 },
  { key: 'medium', label: 'Medium', number: 3 },
  { key: 'low', label: 'Low', number: 4 },
  { key: 'no_priority', label: 'None', number: 5 },
] as const;

export function PriorityIcon({ priority }: { priority: string }) {
  if (priority === 'urgent') return <span title="Urgent" className="size-4 shrink-0 flex items-center justify-center text-rose-600 dark:text-rose-400"><AlertCircle className="size-3.5" /></span>;
  if (priority === 'high') return <span title="High Priority" className="size-4 shrink-0 flex items-center justify-center text-amber-500"><SignalHigh className="size-3.5" /></span>;
  if (priority === 'medium') return <span title="Medium Priority" className="size-4 shrink-0 flex items-center justify-center text-blue-500"><SignalMedium className="size-3.5" /></span>;
  if (priority === 'low') return <span title="Low Priority" className="size-4 shrink-0 flex items-center justify-center text-muted-foreground/60"><SignalLow className="size-3.5" /></span>;
  return <span title="No Priority" className="size-4 shrink-0 flex items-center justify-center text-muted-foreground/30"><Minus className="size-3" /></span>;
}

export function PriorityPicker({ priority, onPriorityChange, className, appearance = 'icon', id }: {
  priority: string;
  onPriorityChange: (priority: string) => void;
  className?: string;
  appearance?: 'icon' | 'badge';
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const label = PRIORITY_CONFIG.find((item) => item.key === priority)?.label ?? priority;
  const handleShortcut = (event: React.KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const item = PRIORITY_CONFIG.find((item) => String(item.number) === event.key);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    if (item.key !== priority) onPriorityChange(item.key);
    setOpen(false);
  };
  const trigger = (
    <button type="button" id={id} title="Change priority (P)" aria-label={`Change priority: ${label}`}
      aria-keyshortcuts="1 2 3 4 5" onKeyDown={handleShortcut}
      className={appearance === 'icon' ? cn('flex size-6 items-center justify-center rounded-md hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring', className) : undefined}>
      <PriorityIcon priority={priority} />
      {appearance === 'badge' && <span className="truncate">{label}</span>}
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        {appearance === 'badge' ? <Badge asChild variant={priority === 'urgent' ? 'destructive' : priority === 'high' ? 'warning' : 'outline'} className={cn('h-6 gap-1.5 px-2 hover:bg-secondary/70', className)}>{trigger}</Badge> : trigger}
      </DropdownMenuTrigger>
      <IssuePickerMenu label="Priority" onKeyDown={handleShortcut}>
        {search => {
          const items = PRIORITY_CONFIG.filter(item => item.label.toLowerCase().includes(search));
          if (!items.length) return <p role="status" className="p-3 text-center text-xs text-muted-foreground">No priorities found.</p>;
          return <DropdownMenuRadioGroup value={priority} onValueChange={(value) => { onPriorityChange(value); setOpen(false); }}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.key} value={item.key} indicatorPosition="before-shortcut" className="py-1.5">
              <PriorityIcon priority={item.key} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <DropdownMenuShortcut className="ml-7 w-3 text-center">{item.number}</DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>;
        }}
      </IssuePickerMenu>
    </DropdownMenu>
  );
}
