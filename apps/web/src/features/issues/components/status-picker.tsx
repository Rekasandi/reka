import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@reka/ui';
import { Check } from 'lucide-react';

export const STATUS_CONFIG: Record<
  string,
  { label: string; number: number; color: string; renderIcon: () => React.ReactNode }
> = {
  backlog: {
    label: 'Backlog',
    number: 1,
    color: '#8f8f8f',
    renderIcon: () => (
      <svg className="size-3.5 text-muted-foreground" viewBox="0 0 16 16" fill="none">
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeDasharray="2 3"
        />
      </svg>
    ),
  },
  todo: {
    label: 'Todo',
    number: 2,
    color: '#e5e5e5',
    renderIcon: () => (
      <svg className="size-3.5 text-muted-foreground" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
  in_progress: {
    label: 'In Progress',
    number: 3,
    color: '#f59e0b',
    renderIcon: () => (
      <svg className="size-3.5 text-amber-500" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 2A6 6 0 0 1 8 14V2z" fill="currentColor" />
      </svg>
    ),
  },
  in_review: {
    label: 'In Review',
    number: 4,
    color: '#10b981',
    renderIcon: () => (
      <svg className="size-3.5 text-emerald-500" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 2A6 6 0 0 1 14 8L8 8V2z" fill="currentColor" />
      </svg>
    ),
  },
  done: {
    label: 'Done',
    number: 5,
    color: '#6366f1',
    renderIcon: () => (
      <svg className="size-3.5 text-indigo-500" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="8" r="7" />
        <path
          d="M5 8.2l2 2 4.2-4.4"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  canceled: {
    label: 'Canceled',
    number: 6,
    color: '#71717a',
    renderIcon: () => (
      <svg className="size-3.5 text-zinc-500" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  duplicate: {
    label: 'Duplicate',
    number: 7,
    color: '#71717a',
    renderIcon: () => (
      <svg className="size-3.5 text-zinc-500" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
        <path d="M4.5 11.5l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

export function StatusIconOnly({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;
  return config.renderIcon();
}

interface StatusPickerProps {
  status: string;
  onStatusChange: (status: string) => void;
  className?: string;
}

export function StatusPicker({ status, onStatusChange, className }: StatusPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Keyboard shortcut listener for 1-7 when open
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const match = Object.entries(STATUS_CONFIG).find(([_, cfg]) => cfg.number.toString() === e.key);
      if (match) {
        e.preventDefault();
        onStatusChange(match[0]);
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onStatusChange]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`flex size-6 items-center justify-center rounded-[4px] hover:bg-secondary transition-colors outline-hidden ${className || ''}`}
          title="Change status"
        >
          <StatusIconOnly status={status} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-56 p-1.5 bg-[#18181b] border border-border text-foreground shadow-2xl rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header like screenshot */}
        <div className="flex items-center justify-between px-2.5 py-1.5 text-xs text-muted-foreground border-b border-border/40 mb-1">
          <span className="font-medium text-[11px] text-muted-foreground/80">Change status...</span>
          <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.2 text-[10px] font-mono">
            S
          </kbd>
        </div>

        <DropdownMenuGroup>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const isSelected = status === key;
            return (
              <DropdownMenuItem
                key={key}
                onClick={() => {
                  onStatusChange(key);
                  setOpen(false);
                }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                  isSelected ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <div className="shrink-0">{cfg.renderIcon()}</div>
                <span className="flex-1 truncate">{cfg.label}</span>
                {isSelected && <Check className="size-3 text-muted-foreground mr-1" />}
                <span className="font-mono text-[10px] text-muted-foreground/50">{cfg.number}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
