import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Skeleton } from '@reka/ui';
import { CalendarDays, Flag, RefreshCw } from 'lucide-react';
import { useRoadmap } from '../hooks/use-initiatives';
import type { RoadmapData } from '../api/initiatives.api';

const parseDate = (value: string | null | undefined) => value ? new Date(value) : null;
const statusName = (value: string) => value.replaceAll('_', ' ');
const monthStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const monthLabel = (date: Date) => date.toLocaleDateString([], { month: 'short', year: 'numeric', timeZone: 'UTC' });

type TimelineRow = { id: string; kind: 'initiative' | 'project' | 'milestone'; name: string; start: Date | null; end: Date | null; status?: string; progress?: number | null };

function makeRows(data: RoadmapData): TimelineRow[] {
  return [
    ...data.initiatives.map(item => ({ id: item.id, kind: 'initiative' as const, name: item.name, start: item.startDate && item.targetDate ? parseDate(item.startDate) : null, end: item.startDate && item.targetDate ? parseDate(item.targetDate) : null, status: item.status, progress: item.progress })),
    ...data.projects.map(item => ({ id: item.id, kind: 'project' as const, name: item.name, start: item.scheduled ? parseDate(item.startDate) : null, end: item.scheduled ? parseDate(item.targetDate) : null, status: item.status, progress: item.progress })),
    ...data.milestones.map(item => ({ id: item.id, kind: 'milestone' as const, name: `${item.projectName} · ${item.name}`, start: null, end: parseDate(item.targetDate) })),
  ];
}

function Timeline({ rows }: { rows: TimelineRow[] }) {
  const scheduledRows = rows.filter(row => row.kind === 'milestone' ? !!row.end : !!row.start && !!row.end);
  const dated = scheduledRows.flatMap(row => [row.start, row.end].filter((date): date is Date => !!date));
  if (!dated.length) return <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No dated initiatives, projects, or milestones yet. Items without a real schedule stay in the Unscheduled list below.</div>;
  const earliest = new Date(Math.min(...dated.map(date => date.getTime())));
  const latest = new Date(Math.max(...dated.map(date => date.getTime())));
  const firstMonth = monthStart(earliest);
  const lastMonth = monthStart(latest);
  const monthCount = (lastMonth.getUTCFullYear() - firstMonth.getUTCFullYear()) * 12 + lastMonth.getUTCMonth() - firstMonth.getUTCMonth() + 1;
  const months = Array.from({ length: monthCount }, (_, index) => new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1)));
  const rangeEnd = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 1));
  const rangeMs = Math.max(1, rangeEnd.getTime() - firstMonth.getTime());
  const position = (date: Date) => Math.max(0, Math.min(100, (date.getTime() - firstMonth.getTime()) / rangeMs * 100));
  const width = Math.max(0.8, position(latest) - position(earliest));
  const minWidth = Math.max(720, 240 + monthCount * 104);
  const sections: Array<[string, TimelineRow[]]> = [
    ['Initiatives', scheduledRows.filter(row => row.kind === 'initiative')],
    ['Projects', scheduledRows.filter(row => row.kind === 'project')],
    ['Milestones', scheduledRows.filter(row => row.kind === 'milestone')],
  ];
  return <div className="overflow-x-auto border-y border-border"><div style={{ minWidth }}>
    <div className="grid border-b border-border bg-muted/20 text-xs text-muted-foreground" style={{ gridTemplateColumns: `240px repeat(${monthCount}, minmax(104px, 1fr))` }}><div className="px-3 py-2 font-medium">Work</div>{months.map(date => <div key={date.toISOString()} className="border-l border-border px-2 py-2">{monthLabel(date)}</div>)}</div>
    {sections.map(([section, sectionRows]) => sectionRows.length > 0 && <section key={section} aria-label={`${section} timeline`}><h2 className="border-b border-border/70 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{section}</h2>{sectionRows.map(row => {
      const milestone = row.kind === 'milestone';
      const start = row.start ?? row.end!;
      const end = row.end ?? row.start!;
      const left = position(start);
      const barWidth = milestone ? 0 : Math.max(0.8, position(end) - left);
      return <div key={`${row.kind}:${row.id}`} className="grid min-h-11 border-b border-border/50 last:border-b-0" style={{ gridTemplateColumns: `240px minmax(${monthCount * 104}px, 1fr)` }}>
        <div className="flex min-w-0 items-center gap-2 px-3"><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-muted-foreground/50" /><span className="min-w-0 truncate text-sm">{row.kind === 'project' ? <Link className="hover:underline" to={`/projects/${row.id}`}>{row.name}</Link> : row.kind === 'initiative' ? <Link className="hover:underline" to={`/initiatives/${row.id}`}>{row.name}</Link> : row.name}</span>{row.progress !== undefined && row.progress !== null && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{row.progress}%</span>}</div>
        <div role="img" aria-label={`${row.kind} ${row.name}, ${start.toLocaleDateString([], { timeZone: 'UTC' })}${milestone ? ' milestone' : ` to ${end.toLocaleDateString([], { timeZone: 'UTC' })}`}`} className="relative min-h-11 border-l border-border/70 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px)] bg-size-[104px_100%]">
          {!milestone ? <div className={`absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-sm px-2 text-[10px] leading-5 text-primary-foreground ${row.kind === 'initiative' ? 'bg-emerald-700 dark:bg-emerald-600' : 'bg-primary'}`} style={{ left: `${left}%`, width: `${Math.min(barWidth, 100 - left)}%` }} title={`${row.name} · ${start.toLocaleDateString([], { timeZone: 'UTC' })} – ${end.toLocaleDateString([], { timeZone: 'UTC' })}`}>{statusName(row.status ?? '')}</div> : <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-600 dark:text-amber-400" style={{ left: `${left}%` }} title={`${row.name} · ${end.toLocaleDateString([], { timeZone: 'UTC' })}`}><Flag className="size-4 fill-current" /></span>}
        </div>
      </div>;
    })}</section>)}
  </div></div>;
}

export function RoadmapPage() {
  const { data, isLoading, isError, refetch } = useRoadmap();
  const rows = React.useMemo(() => data ? makeRows(data) : [], [data]);
  const unscheduledInitiatives = data?.initiatives.filter(item => !item.startDate || !item.targetDate) ?? [];
  const unscheduledProjects = data?.projects.filter(project => !project.scheduled) ?? [];
  const unscheduledMilestones = data?.milestones.filter(item => !item.targetDate) ?? [];
  const unscheduledCount = unscheduledInitiatives.length + unscheduledProjects.length + unscheduledMilestones.length;

  return <main className="flex min-w-0 flex-col gap-5 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Roadmap</h1><p className="mt-1 max-w-2xl text-xs text-muted-foreground">Dates, milestones and dependencies from projects you can access. Unscheduled work has no fabricated timeline position.</p></div><Button asChild variant="outline"><Link to="/initiatives"><Flag data-icon="inline-start" />Manage initiatives</Link></Button></header>
    {isLoading && <div role="status" aria-label="Loading roadmap" className="space-y-2"><Skeleton className="h-12 w-full" />{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-11 w-full" />)}</div>}
    {isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-destructive/30 p-4 text-sm"><span>Could not load roadmap data.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>}
    {!isLoading && !isError && data && <>
      {!data.initiatives.length && !data.projects.length && <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No accessible initiatives or projects yet.</div>}
      <p className="text-xs text-muted-foreground md:hidden">Swipe the timeline horizontally to view later dates.</p>
      <Timeline rows={rows} />
      {unscheduledCount > 0 && <section><h2 className="mb-2 text-sm font-semibold">Unscheduled <Badge variant="outline">{unscheduledCount}</Badge></h2><p className="mb-3 text-xs text-muted-foreground">A start and target date are needed for initiatives/projects; milestones need a target date.</p><ul className="divide-y divide-border border-y border-border">{unscheduledInitiatives.map(item => <li key={`i:${item.id}`} className="px-3 py-2 text-sm"><Link className="hover:underline" to={`/initiatives/${item.id}`}>{item.name}</Link><span className="ml-2 text-xs text-muted-foreground">Initiative · missing {item.startDate ? 'target' : item.targetDate ? 'start' : 'start and target'} date</span></li>)}{unscheduledProjects.map(item => <li key={`p:${item.id}`} className="px-3 py-2 text-sm"><Link className="hover:underline" to={`/projects/${item.id}`}>{item.name}</Link><span className="ml-2 text-xs text-muted-foreground">Project · missing {item.startDate ? 'target' : item.targetDate ? 'start' : 'start and target'} date</span></li>)}{unscheduledMilestones.map(item => <li key={`m:${item.id}`} className="px-3 py-2 text-sm">{item.projectName} · {item.name}<span className="ml-2 text-xs text-muted-foreground">Milestone · no target date</span></li>)}</ul></section>}
      <section><h2 className="mb-2 text-sm font-semibold">Dependencies <Badge variant="outline">{data.dependencies.length}</Badge></h2>{data.dependencies.length ? <ul className="divide-y divide-border border-y border-border">{data.dependencies.map(edge => <li key={`${edge.projectId}:${edge.dependsOnProjectId}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"><Link className="hover:underline" to={`/projects/${edge.projectId}`}>{edge.projectName}</Link><span aria-label="depends on" className="text-muted-foreground">depends on</span><Link className="hover:underline" to={`/projects/${edge.dependsOnProjectId}`}>{edge.dependsOnProjectName}</Link></li>)}</ul> : <p className="border border-dashed border-border p-4 text-sm text-muted-foreground">No visible project dependencies.</p>}</section>
    </>}
  </main>;
}
