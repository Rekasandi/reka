import * as React from 'react';
import type { IssueType } from '@reka/types';
import {
  Badge, cn, DropdownMenu, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuShortcut,
} from '@reka/ui';
import { IssuePickerMenu } from './issue-picker-menu';

export const ISSUE_TYPES = [
  { value: 'task', label: 'Task', shortcut: '1', color: 'bg-amber-400' },
  { value: 'bug', label: 'Bug', shortcut: '2', color: 'bg-rose-500' },
  { value: 'feature', label: 'Feature', shortcut: '3', color: 'bg-indigo-500' },
  { value: 'improvement', label: 'Improvement', shortcut: '4', color: 'bg-cyan-500' },
  { value: 'chore', label: 'Chore', shortcut: '5', color: 'bg-muted-foreground' },
] as const;

export function IssueTypePicker({ type, onTypeChange, identifier, compact = false, className, id }: {
  type: IssueType;
  onTypeChange: (type: IssueType) => void;
  identifier?: string;
  compact?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = ISSUE_TYPES.find((item) => item.value === type);
  const handleShortcut = (event: React.KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const item = ISSUE_TYPES.find((item) => item.shortcut === event.key);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    if (item.value !== type) onTypeChange(item.value);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        <Badge asChild variant={type === 'bug' ? 'destructive' : 'warning'} className={cn('h-6 gap-1.5 px-2 hover:bg-secondary/70', className)}>
          <button type="button" id={id} title="Change issue type"
            aria-label={`Change issue type${identifier ? ` for ${identifier}` : ''}: ${selected?.label ?? type}`}
            aria-keyshortcuts="1 2 3 4 5" onKeyDown={handleShortcut}>
            <span className="size-1.5 shrink-0 rounded-full bg-current" />
            <span className={cn('truncate', compact && 'hidden sm:inline')}>{selected?.label ?? type}</span>
          </button>
        </Badge>
      </DropdownMenuTrigger>
      <IssuePickerMenu label="Issue type" onKeyDown={handleShortcut}>
        {search => {
          const items = ISSUE_TYPES.filter(item => item.label.toLowerCase().includes(search));
          if (!items.length) return <p role="status" className="p-3 text-center text-xs text-muted-foreground">No issue types found.</p>;
          return <DropdownMenuRadioGroup value={type} onValueChange={(value) => {
          const item = ISSUE_TYPES.find((item) => item.value === value);
          if (item && item.value !== type) onTypeChange(item.value);
          setOpen(false);
        }}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value} indicatorPosition="before-shortcut" className="py-1.5">
              <span className={`size-1.5 shrink-0 rounded-full ${item.color}`} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <DropdownMenuShortcut className="ml-7 w-3 text-center">{item.shortcut}</DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>;
        }}
      </IssuePickerMenu>
    </DropdownMenu>
  );
}
