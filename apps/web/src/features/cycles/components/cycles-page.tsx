import * as React from 'react';
import { Badge, Button, Skeleton } from '@reka/ui';
import { CalendarClock, Plus, RefreshCw, Repeat, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCycles, useReopenCycle } from '../hooks/use-cycles';
import { CreateCycleDialog } from './create-cycle-dialog';
import { CompleteCycleDialog } from './complete-cycle-dialog';
import { CycleStatusBadge } from './cycle-status-badge';
import { CycleScheduleDialog } from './cycle-schedule-dialog';
import type { Cycle } from '../api/cycles.api';

function formatDateRange(start: string, end: string) {
  return `${new Date(start).toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${new Date(end).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function CyclesPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);
  const [completeCycleTarget, setCompleteCycleTarget] = React.useState<Cycle | null>(null);
  const [params, setParams] = useSearchParams();
  const teamId = params.get('teamId');
  const status = params.get('status') || 'all';
  const filterTab = ['all', 'active', 'upcoming', 'completed'].includes(status) ? status : 'all';
  const setFilterTab = (value: string) => setParams(current => {
    if (value === 'all') current.delete('status'); else current.set('status', value);
    return current;
  });
  const { data: cycles = [], isLoading, isError, refetch } = useCycles();
  const reopenMutation = useReopenCycle();
  const scopedCycles = teamId ? cycles.filter(cycle => cycle.teamId === teamId) : cycles;
  const filteredCycles = filterTab === 'all' ? scopedCycles : scopedCycles.filter(cycle => cycle.status === filterTab);
  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1"><div className="flex items-center gap-2.5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cycles</h1><Badge variant="outline">{scopedCycles.length}</Badge></div><p className="text-xs text-muted-foreground">Plan issues into scheduled cycles and track completion.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setIsScheduleOpen(true)}><CalendarClock data-icon="inline-start" />Schedule settings</Button><Button onClick={() => setIsCreateOpen(true)}><Plus data-icon="inline-start" />New Cycle</Button></div>
      </div>
      <div aria-label="Cycle filters" className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {['all', 'active', 'upcoming', 'completed'].map(filter => <Button key={filter} variant="category" size="sm" aria-pressed={filterTab === filter} onClick={() => setFilterTab(filter)}>{filter[0].toUpperCase() + filter.slice(1)}</Button>)}
      </div>
      {isLoading ? <div role="status" aria-label="Loading cycles" className="flex flex-col gap-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div> : isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 py-6"><p className="text-sm text-muted-foreground">Could not load cycles.</p><Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>
      ) : filteredCycles.length ? (
        <ul aria-label="Cycles" className="divide-y divide-border">
          {filteredCycles.map(cycle => <li key={cycle.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
            <Link to={`/cycles/${cycle.id}`} aria-label={`Open cycle ${cycle.name || `Cycle ${cycle.number}`}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Repeat className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col gap-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{cycle.name || `Cycle ${cycle.number}`}</span><CycleStatusBadge status={cycle.status} /></span><span className="truncate text-xs text-muted-foreground">{cycle.description || 'No objectives added.'}</span><span className="text-xs text-muted-foreground">{formatDateRange(cycle.startDate, cycle.endDate)}</span></span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground sm:hidden" />
            </Link>
            <div className="flex shrink-0 items-center justify-between gap-5 pl-8 text-xs sm:pl-0">
              <span className="text-muted-foreground tabular-nums">{cycle.completedIssues ?? 0} / {cycle.totalIssues ?? 0} completed</span>
              <span className="tabular-nums">{cycle.progress ?? 0}%</span>
              <Button variant="ghost" size="sm" disabled={reopenMutation.isPending} onClick={() => cycle.isCompleted ? reopenMutation.mutate(cycle.id) : setCompleteCycleTarget(cycle)}>{cycle.isCompleted ? 'Reopen' : 'End Cycle'}</Button>
            </div>
          </li>)}
        </ul>
      ) : <div className="flex flex-col items-center gap-2 py-16"><p className="text-sm font-medium">{scopedCycles.length ? 'No matching cycles' : 'No cycles yet'}</p><p className="text-sm text-muted-foreground">{scopedCycles.length ? 'Choose another filter to see your cycles.' : 'Create a cycle to schedule work for your team.'}</p></div>}
      <CreateCycleDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <CycleScheduleDialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen} />
      <CompleteCycleDialog cycle={completeCycleTarget} open={!!completeCycleTarget} onOpenChange={open => !open && setCompleteCycleTarget(null)} />
    </div>
  );
}
