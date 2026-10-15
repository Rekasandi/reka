import type { ReactNode } from 'react';
import { Badge, cn } from '@reka/ui';
import { ChevronDown, Plus } from 'lucide-react';

export function WorkPageHeader({ title, count, description, children }: {
  title: string;
  count: number;
  description: string;
  children?: ReactNode;
}) {
  return <div data-slot="work-page-header" className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl">{title}</h1>
        <Badge variant="outline" className="font-mono text-xs font-medium tabular-nums">{count}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
  </div>;
}

export function WorkListGroupHeader({ label, count, icon, resource, collapsed, onToggle, onCreate, controlsId, sticky = true }: {
  label: string;
  count: number;
  icon: ReactNode;
  resource: 'issues' | 'projects';
  collapsed: boolean;
  onToggle: () => void;
  onCreate?: () => void;
  controlsId?: string;
  sticky?: boolean;
}) {
  return <div data-slot="work-list-group-header" className={cn('flex items-center justify-between rounded-t-[6px] border-b border-border/70 bg-background/95 px-2 py-1.5 backdrop-blur-md', sticky && 'sticky top-0 z-20')}>
    <button type="button" onClick={onToggle} aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${label} ${resource}`} aria-expanded={!collapsed} aria-controls={controlsId}
      className="flex h-6 min-w-0 items-center gap-2 rounded-[4px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <ChevronDown aria-hidden="true" className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-200', collapsed && '-rotate-90')} />
      <span className="flex shrink-0 items-center">{icon}</span>
      <span data-slot="work-list-group-label" className="truncate text-xs font-semibold tracking-tight text-foreground">{label}</span>
      <span data-slot="work-list-group-count" className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
    </button>
    {onCreate && <button type="button" onClick={onCreate} aria-label={`New ${resource === 'issues' ? 'issue' : 'project'} in ${label}`} title={`New ${resource === 'issues' ? 'issue' : 'project'} in ${label}`}
      className="flex size-6 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Plus aria-hidden="true" className="size-3.5" /></button>}
  </div>;
}
