import * as React from 'react';
import {
  Badge,
  cn,
  DropdownMenuShortcut,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@reka/ui';
import { IssuePickerMenu } from './issue-picker-menu';
import { useTeamWorkflowStates } from '../../teams/hooks/use-teams';

export const STATUS_CONFIG: Record<
  string,
  { label: string; number: number; color: string; renderIcon: () => React.ReactNode }
> = {
  triage: {
    label: 'Triage',
    number: 0,
    color: '#ec9a3c',
    renderIcon: () => <span className="size-2 rounded-full bg-orange-500" />,
  },
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
    color: '#ebebeb',
    renderIcon: () => (
      <svg className="size-3.5 text-muted-foreground" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
      </svg>
    ),
  },
  in_progress: {
    label: 'In Progress',
    number: 3,
    color: '#f5a623',
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
    color: '#50e3c2',
    renderIcon: () => (
      <svg className="size-3.5 text-emerald-500" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 2A6 6 0 0 1 14 8L8 8V2z" fill="currentColor" />
      </svg>
    ),
  },
  ready_to_deploy: {
    label: 'Ready to Deploy',
    number: 5,
    color: '#0070f3',
    renderIcon: () => (
      <svg className="size-3.5 text-cyan-500" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
        <path d="M8 4l2.5 3.5H5.5L8 4z M8 8.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  done: {
    label: 'Done',
    number: 6,
    color: '#7928ca',
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
    number: 7,
    color: '#8f8f8f',
    renderIcon: () => (
      <svg className="size-3.5 text-zinc-500" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  blocked: {
    label: 'Blocked',
    number: 8,
    color: '#ee0000',
    renderIcon: () => (
      <svg className="size-3.5 text-rose-500" viewBox="0 0 16 16" fill="none">
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
  appearance?: 'icon' | 'badge';
  id?: string;
  teamId?: string;
}

export function StatusPicker({ status, onStatusChange, className, appearance = 'icon', id, teamId }: StatusPickerProps) {
  const [open, setOpen] = React.useState(false);
  const { data: configuredStates = [] } = useTeamWorkflowStates(teamId);
  const options = configuredStates.length
    ? configuredStates.filter((state) => state.isActive).map((state) => ({ key: state.key, label: state.name, number: state.position + 1, color: state.color, category: state.category, renderIcon: () => STATUS_CONFIG[state.key]?.renderIcon() ?? <span className="size-3 rounded-full border border-current" style={{ color: state.color, backgroundColor: `${state.color}30` }} /> }))
    : Object.entries(STATUS_CONFIG).map(([key, config]) => ({ key, ...config, category: key === 'triage' ? 'triage' : ['done'].includes(key) ? 'completed' : key === 'canceled' ? 'canceled' : ['backlog'].includes(key) ? 'backlog' : ['todo'].includes(key) ? 'unstarted' : 'started' }));
  const selected = options.find((option) => option.key === status);
  const correctedStatus = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!teamId || !configuredStates.length) return;
    if (selected) { correctedStatus.current = null; return; }
    const firstActive = configuredStates.find((state) => state.isActive);
    const marker = `${teamId}:${status}`;
    if (firstActive && correctedStatus.current !== marker) {
      correctedStatus.current = marker;
      onStatusChange(firstActive.key);
    }
  }, [teamId, configuredStates, selected, status, onStatusChange]);
  const statusLabel = selected?.label ?? STATUS_CONFIG[status]?.label ?? status.replaceAll('_', ' ');

  const handleShortcut = (event: React.KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const selected = options.find((option) => String(option.number) === event.key);
    if (!selected) return;
    event.preventDefault();
    event.stopPropagation();
    if (selected.key !== status) onStatusChange(selected.key);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        {appearance === 'badge' ? (
          <Badge asChild variant={selected?.category === 'canceled' || status === 'blocked' ? 'destructive' : selected?.category === 'started' ? 'warning' : selected?.category === 'completed' ? 'success' : 'outline'} className={cn('h-6 gap-1.5 px-2 hover:bg-secondary/70', className)}>
            <button
              type="button"
              id={id}
              aria-label={`Change status: ${statusLabel}`}
              aria-keyshortcuts="1 2 3 4 5 6 7 8"
              title="Change status"
              onKeyDown={handleShortcut}
            >
              <StatusIconOnly status={status} />
              <span>{statusLabel}</span>
            </button>
          </Badge>
        ) : (
          <button
            type="button"
            id={id}
            className={cn('flex size-6 items-center justify-center rounded-md hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring', className)}
            title="Change status"
            aria-label={`Change status: ${statusLabel}`}
            aria-keyshortcuts="1 2 3 4 5 6 7 8"
            onKeyDown={handleShortcut}
          >
            <StatusIconOnly status={status} />
          </button>
        )}
      </DropdownMenuTrigger>

      <IssuePickerMenu label="Status" onKeyDown={handleShortcut}>
        {search => {
          const items = options.filter((option) => option.label.toLowerCase().includes(search));
          if (!items.length) return <p role="status" className="p-3 text-center text-xs text-muted-foreground">No statuses found.</p>;
          return <DropdownMenuRadioGroup value={status} onValueChange={(value) => { onStatusChange(value); setOpen(false); }}>
          {items.map((cfg) => (
            <DropdownMenuRadioItem
              key={cfg.key}
              value={cfg.key}
              indicatorPosition="before-shortcut"
              className="py-1.5"
            >
              {cfg.renderIcon()}
              <span className="min-w-0 flex-1 truncate">{cfg.label}</span>
              <DropdownMenuShortcut className="ml-7 w-3 text-center">{cfg.number}</DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>;
        }}
      </IssuePickerMenu>
    </DropdownMenu>
  );
}
