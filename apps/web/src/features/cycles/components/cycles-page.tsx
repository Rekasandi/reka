import * as React from 'react';
import { Alert, AlertDescription, Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger, Skeleton, Tabs, TabsList, TabsTrigger } from '@reka/ui';
import { CalendarClock, CircleCheck, CircleDashed, CirclePause, CirclePlay, MoreHorizontal, Plus, RefreshCw, Triangle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCycles, useReopenCycle } from '../hooks/use-cycles';
import { useTeams } from '../../teams/hooks/use-teams';
import { CreateCycleDialog } from './create-cycle-dialog';
import { CompleteCycleDialog } from './complete-cycle-dialog';
import { CycleScheduleDialog } from './cycle-schedule-dialog';
import { CycleProgressChart } from './cycle-progress-chart';
import type { Cycle } from '../api/cycles.api';

function MetricRing({ percent, overCapacity = false }: { percent: number | null; overCapacity?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0 -rotate-90"><circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" strokeWidth="2.5" />{percent !== null && <circle cx="10" cy="10" r="8" fill="none" stroke={overCapacity ? 'var(--destructive)' : 'var(--cycle-completed)'} strokeWidth="2.5" pathLength="100" strokeDasharray={`${Math.max(1, Math.min(100, percent))} 100`} strokeLinecap="round" />}</svg>;
}

function CapacityMetric({ cycle }: { cycle: Cycle }) {
  const completed = cycle.status === 'completed';
  const capacity = cycle.capacity;
  const planned = cycle.plannedEstimate ?? 0;
  const percent = completed ? cycle.progress ?? 0 : capacity != null && capacity > 0 ? Math.round(planned / capacity * 100) : capacity === 0 && planned === 0 ? 0 : null;
  const over = !completed && capacity != null && planned > capacity;
  return <span className="cycle-capacity inline-flex items-center gap-2 tabular-nums" title={completed ? 'Completed issues divided by current scope' : capacity == null ? 'Estimate-point capacity has not been set' : `${planned} estimate points / ${capacity} capacity`}>
    <MetricRing percent={percent} overCapacity={over} />
    {percent === null ? <span className="text-muted-foreground">{over ? 'Over capacity' : 'No capacity set'}</span> : <><span>{percent}%</span><span className="text-muted-foreground">{completed ? 'success' : 'of capacity'}</span></>}
  </span>;
}

function TimelineDate({ date }: { date: string }) {
  const value = new Date(date);
  return <time className="cycle-timeline-date" dateTime={date} title={value.toLocaleDateString([], { dateStyle: 'full' })}><span>{value.toLocaleDateString([], { month: 'short' })}</span><span>{value.getDate()}</span></time>;
}

export function CyclesPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = React.useState(false);
  const [completeCycleTarget, setCompleteCycleTarget] = React.useState<Cycle | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>();
  const [params, setParams] = useSearchParams();
  const teamId = params.get('teamId');
  const status = params.get('status') || 'all';
  const filterTab = ['all', 'active', 'upcoming', 'completed'].includes(status) ? status : 'all';
  React.useEffect(() => { setExpandedId(undefined); }, [teamId, filterTab]);
  const setFilterTab = (value: string) => { if (value === filterTab) return; setExpandedId(undefined); setParams(current => { if (value === 'all') current.delete('status'); else current.set('status', value); return current; }); };
  const { data: cycles = [], isLoading, isError, refetch } = useCycles();
  const { data: teams = [] } = useTeams();
  const reopenMutation = useReopenCycle();
  const scopedCycles = cycles.filter(cycle => !teamId || cycle.teamId === teamId);
  const filteredCycles = scopedCycles.filter(cycle => filterTab === 'all' || cycle.status === filterTab)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime() || b.number - a.number || a.id.localeCompare(b.id));
  const defaultExpandedId = filteredCycles.find(cycle => cycle.status === 'active')?.id;
  const openId = expandedId === undefined ? defaultExpandedId : expandedId;
  const nearestUpcoming = new Set(teams.map(team => scopedCycles.filter(cycle => cycle.teamId === team.id && cycle.status === 'upcoming').sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0]?.id));
  const canManage = teams.some(team => team.canManage && (!teamId || team.id === teamId));

  return <div className="cycles-timeline-page flex min-w-0 flex-col gap-5 pb-10">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cycles</h1><Badge variant="outline">{scopedCycles.length}</Badge></div>
      {canManage && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setIsScheduleOpen(true)}><CalendarClock data-icon="inline-start" />Schedule settings</Button><Button size="sm" onClick={() => setIsCreateOpen(true)}><Plus data-icon="inline-start" />New Cycle</Button></div>}
    </header>
    <Tabs value={filterTab} onValueChange={setFilterTab} activationMode="manual">
      <TabsList variant="line" aria-label="Cycle filters" className="w-full justify-start gap-3 border-b border-border p-0 sm:gap-5">
        {[['all', 'All cycles'], ['active', 'Current'], ['upcoming', 'Upcoming'], ['completed', 'Completed']].map(([value, label]) => <TabsTrigger key={value} value={value} aria-label={label} className="h-9 flex-none rounded-none border-0 px-0">{value === 'all' ? 'All' : label}</TabsTrigger>)}
      </TabsList>
    </Tabs>
    {isLoading ? <div role="status" aria-label="Loading cycles" className="flex flex-col gap-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div> : isError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center gap-3">Could not load cycles.<Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></AlertDescription></Alert> : filteredCycles.length ? <ol aria-label="Cycles" className="cycle-timeline">
      {filteredCycles.map((cycle, index) => {
        const team = teams.find(team => team.id === cycle.teamId);
        const label = cycle.name || `Cycle ${cycle.number}`;
        const state = cycle.status === 'active' ? 'Current' : cycle.status === 'completed' ? 'Completed' : nearestUpcoming.has(cycle.id) ? 'Upcoming' : 'Planned';
        const Icon = state === 'Completed' ? CircleCheck : state === 'Planned' ? CircleDashed : CirclePlay;
        const older = filteredCycles[index + 1];
        const hasBreak = filterTab === 'all' && older?.teamId === cycle.teamId && new Date(cycle.startDate).getTime() - new Date(older.endDate).getTime() >= 86_400_000;
        return <React.Fragment key={cycle.id}>
          <li className="cycle-timeline-entry" data-cycle-status={cycle.status}>
            <TimelineDate date={cycle.startDate} />
            <Collapsible open={openId === cycle.id} onOpenChange={open => setExpandedId(open ? cycle.id : null)} className="cycle-timeline-content">
              <div className="cycle-timeline-header">
                <CollapsibleTrigger className="cycle-timeline-trigger" aria-label={`Toggle ${label} summary`}>
                  <span className="cycle-timeline-name"><Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="flex min-w-0 flex-col gap-0.5"><span className="truncate font-medium">{label}</span>{!teamId && team && <span className="truncate text-xs text-muted-foreground">{team.name}</span>}</span></span>
                  <span className="cycle-timeline-metrics"><Badge variant="secondary" className="rounded-[3px]">{state}</Badge><CapacityMetric cycle={cycle} />{cycle.status === 'completed' && <span className="cycle-completed-count inline-flex items-center gap-1.5 tabular-nums"><Triangle aria-hidden="true" className="size-3.5 text-muted-foreground" />{cycle.completedIssues ?? 0}<span className="text-muted-foreground">completed</span></span>}<span className="cycle-scope-count inline-flex items-center gap-1.5 tabular-nums"><Triangle aria-hidden="true" className="size-3.5 text-muted-foreground" />{cycle.totalIssues ?? 0}<span className="text-muted-foreground">scope</span></span></span>
                </CollapsibleTrigger>
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuGroup>
                  <DropdownMenuItem asChild><Link to={`/cycles/${cycle.id}`}>Open cycle</Link></DropdownMenuItem>
                  {team?.canManage && <DropdownMenuItem disabled={reopenMutation.isPending} onClick={() => cycle.isCompleted ? reopenMutation.mutate(cycle.id) : setCompleteCycleTarget(cycle)}>{cycle.isCompleted ? 'Reopen' : 'End Cycle'}</DropdownMenuItem>}
                </DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
              </div>
              <CollapsibleContent>
                {openId === cycle.id && <div className="cycle-timeline-expanded">
                  <CycleProgressChart cycle={cycle} />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{new Date(cycle.startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} to {new Date(cycle.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span><Button asChild variant="link" size="sm" className="border-0"><Link to={`/cycles/${cycle.id}`} aria-label={`Open cycle ${label}`}>Open cycle details</Link></Button></div>
                </div>}
              </CollapsibleContent>
            </Collapsible>
          </li>
          {hasBreak && <li className="cycle-timeline-entry cycle-timeline-break"><TimelineDate date={older.endDate} /><div className="cycle-timeline-content flex min-h-12 items-center gap-3 text-sm text-muted-foreground"><CirclePause aria-hidden="true" className="size-4" />Cycle break</div></li>}
        </React.Fragment>;
      })}
    </ol> : <div className="flex flex-col items-center gap-2 py-16"><p className="text-sm font-medium">{scopedCycles.length ? 'No matching cycles' : 'No cycles yet'}</p><p className="text-sm text-muted-foreground">{scopedCycles.length ? 'Choose another filter to see your cycles.' : 'Cycles will appear here when your team schedules work.'}</p></div>}
    <CreateCycleDialog key={`create-${teamId ?? 'all'}`} open={isCreateOpen} onOpenChange={setIsCreateOpen} defaultTeamId={teamId ?? undefined} />
    <CycleScheduleDialog key={`schedule-${teamId ?? 'all'}`} open={isScheduleOpen} onOpenChange={setIsScheduleOpen} defaultTeamId={teamId ?? undefined} />
    <CompleteCycleDialog cycle={completeCycleTarget} open={!!completeCycleTarget} onOpenChange={open => !open && setCompleteCycleTarget(null)} />
  </div>;
}
