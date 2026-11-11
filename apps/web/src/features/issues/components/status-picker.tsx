import * as React from 'react';
import { Badge, cn, DropdownMenuShortcut, DropdownMenu, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, Button, FieldDescription } from '@reka/ui';
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
    renderIcon: () => <span className="size-2 rounded-full bg-warning" />,
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
      <svg className="size-3.5 text-warning" viewBox="0 0 16 16" fill="none">
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
      <svg className="size-3.5 text-success" viewBox="0 0 16 16" fill="none">
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
      <svg className="size-3.5 text-info" viewBox="0 0 16 16" fill="none">
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
      <svg className="size-3.5 text-info" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="8" r="7" />
        <path
          d="M5 8.2l2 2 4.2-4.4"
          fill="none"
          stroke="var(--background)"
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
      <svg className="size-3.5 text-muted-foreground" viewBox="0 0 16 16" fill="none">
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
      <svg className="size-3.5 text-destructive" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
        <path d="M4.5 11.5l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

export function formatStatusLabel(status?: string | null): string {
  if (!status) return '';
  if (STATUS_CONFIG[status]) return STATUS_CONFIG[status].label;
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Linear-style workflow icon: the category decides the shape, the state's own colour tints it. */
export function renderStateIcon(category: string, color?: string | null) {
  const style = { color: color || CATEGORY_DEFAULT_COLOR[category] || '#8f8f8f' };
  const common = { className: 'size-3.5 shrink-0', viewBox: '0 0 16 16', style, 'aria-hidden': true } as const;
  switch (category) {
    case 'triage': return <svg {...common} fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" /><circle cx="8" cy="8" r="2.5" fill="currentColor" /></svg>;
    case 'backlog': return <svg {...common} fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" strokeDasharray="2 3" /></svg>;
    case 'unstarted': return <svg {...common} fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" /></svg>;
    case 'started': return <svg {...common} fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" /><path d="M8 4.5A3.5 3.5 0 0 1 8 11.5z" fill="currentColor" /></svg>;
    case 'completed': return <svg {...common} fill="currentColor"><circle cx="8" cy="8" r="7" /><path d="M5 8.2l2 2 4.2-4.4" fill="none" stroke="var(--background, #fff)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case 'canceled': return <svg {...common} fill="currentColor"><circle cx="8" cy="8" r="7" /><path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--background, #fff)" strokeWidth="1.6" strokeLinecap="round" /></svg>;
    default: return <svg {...common} fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" /></svg>;
  }
}
/** Default tint per workflow category; a state's own (user-picked) colour overrides it. */
export const CATEGORY_DEFAULT_COLOR: Record<string, string> = { triage: '#ec9a3c', backlog: '#8f8f8f', unstarted: '#8f8f8f', started: '#f5a623', completed: '#7928ca', canceled: '#8f8f8f' };

/** Pass `category` (and `color`) when known, or `teamId` to look the state up; otherwise falls back to the built-in icons. */
export function StatusIconOnly({ status, category, color, teamId }: { status: string; category?: string | null; color?: string | null; teamId?: string }) {
  const { data: states = [] } = useTeamWorkflowStates(category ? undefined : teamId);
  const state = states.find((item) => item.key === status);
  const resolved = category ?? state?.category;
  if (resolved) return renderStateIcon(resolved, color ?? state?.color);
  return (STATUS_CONFIG[status] || STATUS_CONFIG.backlog).renderIcon();
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
    ? configuredStates.filter((state) => state.isActive).map((state) => ({ key: state.key, label: state.name, number: state.position + 1, color: state.color, category: state.category, renderIcon: () => renderStateIcon(state.category, state.color) }))
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
            <Button variant="plain" size="auto"
              type="button"
              id={id}
              aria-label={`Change status: ${statusLabel}`}
              aria-keyshortcuts="1 2 3 4 5 6 7 8"
              title="Change status"
              onKeyDown={handleShortcut}
            >
              <StatusIconOnly status={status} teamId={teamId} />
              <span>{statusLabel}</span>
            </Button>
          </Badge>
        ) : (
          <Button variant="plain" size="auto"
            type="button"
            id={id}
            className={cn('flex size-6 items-center justify-center rounded-md hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-ring', className)}
            title="Change status"
            aria-label={`Change status: ${statusLabel}`}
            aria-keyshortcuts="1 2 3 4 5 6 7 8"
            onKeyDown={handleShortcut}
          >
            <StatusIconOnly status={status} teamId={teamId} />
          </Button>
        )}
      </DropdownMenuTrigger>

      <IssuePickerMenu label="Status" onKeyDown={handleShortcut}>
        {search => {
          const items = options.filter((option) => option.label.toLowerCase().includes(search));
          if (!items.length) return <FieldDescription role="status" className="p-3 text-center text-xs text-muted-foreground">No statuses found.</FieldDescription>;
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
