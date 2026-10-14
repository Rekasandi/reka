import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Input, Skeleton } from '@reka/ui';
import { AlertCircle, RefreshCw, BarChart3, Timer, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getCycleInsights, getInsightsOverview } from '../api/insights.api';
import { useTeams } from '../../teams/hooks/use-teams';
import { useProjects } from '../../projects/hooks/use-projects';
import { useCycles } from '../../cycles/hooks/use-cycles';
import { useSavedViews } from '../../views/hooks/use-views';

function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function defaultFrom() { const date = new Date(); date.setDate(date.getDate() - 29); return localDay(date); }
function formatHours(value: number | null) {
  if (value === null) return '—';
  return value < 24 ? `${value} h` : `${Math.round(value / 24 * 10) / 10} d`;
}
function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: 'medium' }).format(new Date(value));
}
function FilterSelect({ label, value, onChange, children }: React.PropsWithChildren<{ label: string; value: string; onChange: (value: string) => void }>) {
  const id = React.useId();
  return <label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>{label}</span><select id={id} value={value} onChange={event => onChange(event.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{children}</select></label>;
}
function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof BarChart3 }) {
  return <section className="flex min-w-0 flex-col gap-2 border-l border-border pl-4 first:border-l-0 first:pl-0 sm:pl-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" />{label}</div><div className="text-xl font-semibold tabular-nums tracking-tight">{value}</div><p className="text-xs leading-5 text-muted-foreground">{detail}</p></section>;
}
function QueryState({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <div role="status" aria-label="Loading insights" className="space-y-2 py-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (error) return <div role="alert" className="flex flex-wrap items-center gap-3 py-8 text-sm text-muted-foreground"><AlertCircle className="size-4 text-destructive" />Could not load report data.<Button variant="outline" size="sm" onClick={retry}><RefreshCw data-icon="inline-start" />Retry</Button></div>;
  return null;
}

export function InsightsPage() {
  const [tab, setTab] = React.useState<'issues' | 'cycles'>('issues');
  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(() => localDay(new Date()));
  const [timezone, setTimezone] = React.useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [teamId, setTeamId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [viewId, setViewId] = React.useState('');
  const [cycleId, setCycleId] = React.useState('');
  const [unit, setUnit] = React.useState<'issues' | 'estimate'>('issues');
  const [page, setPage] = React.useState(1);
  const teamsQuery = useTeams(); const projectsQuery = useProjects(); const cyclesQuery = useCycles(); const viewsQuery = useSavedViews();
  const teams = teamsQuery.data ?? []; const projects = projectsQuery.data ?? []; const cycles = cyclesQuery.data ?? []; const views = viewsQuery.data ?? [];
  const visibleProjects = projects.filter(project => !teamId || project.teamId === teamId);
  const visibleCycles = cycles.filter(cycle => !teamId || cycle.teamId === teamId);
  const baseFilters = { from, to, timezone, ...(teamId ? { teamId } : {}) };
  const overviewFilters = { ...baseFilters, ...(projectId ? { projectId } : {}), ...(viewId ? { viewId } : {}), page, pageSize: 20 };
  const overview = useQuery({ queryKey: ['insights-overview', overviewFilters], queryFn: () => getInsightsOverview(overviewFilters), enabled: tab === 'issues' });
  const cycleMetrics = useQuery({ queryKey: ['insights-cycles', baseFilters, cycleId, unit], queryFn: () => getCycleInsights({ ...baseFilters, ...(cycleId ? { cycleId } : {}), unit }), enabled: tab === 'cycles' });
  const changeTeam = (value: string) => { setTeamId(value); setProjectId(''); setCycleId(''); setViewId(''); setPage(1); };
  const resetPage = (action: () => void) => { action(); setPage(1); };

  return <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-12">
    <header className="flex flex-col gap-1"><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Insights</h1><Badge variant="outline">Reports</Badge></div><p className="text-xs text-muted-foreground">Delivery metrics from recorded workflow and cycle history.</p></header>
    <nav aria-label="Insight reports" className="flex gap-1 border-b border-border">
      <Button variant="category" size="sm" aria-pressed={tab === 'issues'} onClick={() => setTab('issues')}><BarChart3 data-icon="inline-start" />Issue trends</Button>
      <Button variant="category" size="sm" aria-pressed={tab === 'cycles'} onClick={() => setTab('cycles')}><RotateCcw data-icon="inline-start" />Cycle delivery</Button>
    </nav>
    <section aria-label="Report filters" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>From</span><Input type="date" value={from} max={to} onChange={event => resetPage(() => setFrom(event.target.value))} /></label>
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>To</span><Input type="date" value={to} min={from} onChange={event => resetPage(() => setTo(event.target.value))} /></label>
      <FilterSelect label="Team" value={teamId} onChange={changeTeam}><option value="">All accessible teams</option>{teams.map(team => <option key={team.id} value={team.id}>{team.key} · {team.name}</option>)}</FilterSelect>
      {tab === 'issues' ? <>
        <FilterSelect label="Project" value={projectId} onChange={value => resetPage(() => setProjectId(value))}><option value="">All projects</option>{visibleProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</FilterSelect>
        <FilterSelect label="Saved view" value={viewId} onChange={value => resetPage(() => setViewId(value))}><option value="">No saved view</option>{views.filter(view => !teamId || !view.teamId || view.teamId === teamId).map(view => <option key={view.id} value={view.id}>{view.name}</option>)}</FilterSelect>
      </> : <>
        <FilterSelect label="Cycle" value={cycleId} onChange={setCycleId}><option value="">Team velocity</option>{visibleCycles.map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.name || `Cycle ${cycle.number}`}</option>)}</FilterSelect>
        <FilterSelect label="Unit" value={unit} onChange={value => setUnit(value as 'issues' | 'estimate')}><option value="issues">Issue count</option><option value="estimate">Estimate points</option></FilterSelect>
      </>}
      <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>Timezone</span><Input aria-label="Report timezone" value={timezone} onChange={event => resetPage(() => setTimezone(event.target.value))} list="insight-timezones" /><datalist id="insight-timezones"><option value="UTC" /><option value="America/Los_Angeles" /><option value="America/New_York" /><option value="Europe/London" /><option value="Asia/Jakarta" /></datalist></label>
    </section>

    {tab === 'issues' && <div className="flex flex-col gap-6">
      <QueryState loading={overview.isLoading} error={overview.isError} retry={() => overview.refetch()} />
      {overview.data && <>
        {!overview.data.history.hasHistory && <p role="status" className="border-l-2 border-border pl-3 text-sm text-muted-foreground">No instrumented issue history is available for these teams yet. Earlier durations are not inferred.</p>}
        <section aria-label="Issue metrics" className="grid grid-cols-2 gap-y-5 border-y border-border py-4 sm:grid-cols-4">
          <Metric label="Throughput" value={String(overview.data.throughput.total)} detail={`${overview.data.throughput.repeatedCompletionEvents} later re-completion event${overview.data.throughput.repeatedCompletionEvents === 1 ? '' : 's'} excluded`} icon={BarChart3} />
          <Metric label="Average lead time" value={formatHours(overview.data.leadTime.averageHours)} detail={`${overview.data.leadTime.sampleSize} measured · ${overview.data.leadTime.missingHistoryCount} missing create history`} icon={Timer} />
          <Metric label="Median lead time" value={formatHours(overview.data.leadTime.medianHours)} detail="Creation to first completed status" icon={Timer} />
          <Metric label="Average cycle time" value={formatHours(overview.data.cycleTime.averageHours)} detail={`${overview.data.cycleTime.sampleSize} measured · ${overview.data.cycleTime.missingHistoryCount} missing start history`} icon={RotateCcw} />
        </section>
        <section className="flex flex-col gap-3">
          <div><h2 className="text-sm font-semibold">Daily throughput</h2><p className="text-xs text-muted-foreground">First recorded transition into a completed category per issue. For {overview.data.throughput.baselineCompletionCount} baseline completion(s), earlier completion history is unknown.</p></div>
          <div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[360px] text-left text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr><th scope="col" className="px-3 py-2 font-medium">Local date</th><th scope="col" className="px-3 py-2 text-right font-medium">Completed issues</th></tr></thead><tbody className="divide-y divide-border">{overview.data.throughput.points.map(point => <tr key={point.date}><th scope="row" className="px-3 py-2 font-normal">{point.date}</th><td className="px-3 py-2 text-right tabular-nums">{point.count}</td></tr>)}</tbody></table></div>
        </section>
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-semibold">Completed issues</h2><p className="text-xs text-muted-foreground">{overview.data.completions.total} first completions in the selected filters.</p></div><span className="text-xs text-muted-foreground">Page {overview.data.completions.page} of {Math.max(1, overview.data.completions.totalPages)}</span></div>
          {overview.data.completions.rows.length ? <div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[540px] text-left text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr><th scope="col" className="px-3 py-2 font-medium">Issue</th><th scope="col" className="px-3 py-2 font-medium">Title</th><th scope="col" className="px-3 py-2 text-right font-medium">Completed</th></tr></thead><tbody className="divide-y divide-border">{overview.data.completions.rows.map(row => <tr key={row.issueId}><td className="px-3 py-2 font-mono">{row.identifier || 'Issue'}</td><td className="max-w-[36rem] truncate px-3 py-2">{row.title || 'Untitled issue'}</td><td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{formatDate(row.completedAt, timezone)}</td></tr>)}</tbody></table></div> : <p className="border-y border-border py-6 text-center text-sm text-muted-foreground">No completed issues match this report.</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || overview.isFetching} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page >= overview.data.completions.totalPages || overview.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div>
        </section>
        <p className="text-xs leading-5 text-muted-foreground">{overview.data.quality.explanation} {overview.data.history.baselineIssueCount} legacy baseline issue histories are unmeasured.</p>
      </>}
    </div>}

    {tab === 'cycles' && <div className="flex flex-col gap-6">
      <QueryState loading={cycleMetrics.isLoading} error={cycleMetrics.isError} retry={() => cycleMetrics.refetch()} />
      {cycleMetrics.data && <>
        <section className="flex flex-col gap-3"><div><h2 className="text-sm font-semibold">Cycle velocity</h2><p className="text-xs text-muted-foreground">Final recorded snapshots from completed cycles in this window.</p></div>
          {cycleMetrics.data.velocity.points.length ? <div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr><th scope="col" className="px-3 py-2 font-medium">Cycle</th><th scope="col" className="px-3 py-2 text-right font-medium">Completed {unit === 'issues' ? 'issues' : 'points'}</th><th scope="col" className="px-3 py-2 text-right font-medium">Missing estimates</th><th scope="col" className="px-3 py-2 text-right font-medium">Recorded</th></tr></thead><tbody className="divide-y divide-border">{cycleMetrics.data.velocity.points.map(point => <tr key={point.cycleId}><th scope="row" className="px-3 py-2 font-medium">{point.cycleName}</th><td className="px-3 py-2 text-right tabular-nums">{point.value}</td><td className="px-3 py-2 text-right tabular-nums">{point.missingEstimateCount}</td><td className="px-3 py-2 text-right text-muted-foreground">{formatDate(point.measuredAt, timezone)}</td></tr>)}</tbody></table></div> : <p className="border-y border-border py-6 text-sm text-muted-foreground">No completed cycle with a final snapshot was recorded in this window.</p>}
          {cycleMetrics.data.velocity.unmeasuredCompletedCycles > 0 && <p className="text-xs text-muted-foreground">{cycleMetrics.data.velocity.unmeasuredCompletedCycles} completed cycle(s) in scope have no recorded snapshots and are excluded.</p>}
          {cycleMetrics.data.velocity.scopeTruncated && <p className="text-xs text-muted-foreground">Showing the 500 most recently started cycles in scope. Narrow by team for complete coverage.</p>}
        </section>
        {cycleId ? <section className="flex flex-col gap-3"><div><h2 className="text-sm font-semibold">Burndown samples</h2><p className="text-xs text-muted-foreground">Recorded remaining work only; no interpolated history.</p></div>
          {cycleMetrics.data.burndown.hasHistory ? <div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-muted/40 text-muted-foreground"><tr><th scope="col" className="px-3 py-2 font-medium">Recorded at</th><th scope="col" className="px-3 py-2 text-right font-medium">Remaining {unit === 'issues' ? 'issues' : 'points'}</th><th scope="col" className="px-3 py-2 text-right font-medium">Completed issues</th><th scope="col" className="px-3 py-2 text-right font-medium">Missing estimates</th></tr></thead><tbody className="divide-y divide-border">{cycleMetrics.data.burndown.points.map(point => <tr key={point.snapshotAt}><th scope="row" className="px-3 py-2 font-normal">{new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(point.snapshotAt))}</th><td className="px-3 py-2 text-right tabular-nums">{point.value}</td><td className="px-3 py-2 text-right tabular-nums">{point.completedIssueCount}</td><td className="px-3 py-2 text-right tabular-nums">{point.missingEstimateCount}</td></tr>)}</tbody></table></div> : <p className="border-y border-border py-6 text-sm text-muted-foreground">{cycleMetrics.data.quality.message}</p>}
          {cycleMetrics.data.burndown.hasHistory && <p className="text-xs text-muted-foreground">{cycleMetrics.data.quality.message}</p>}
        </section> : <p className="text-xs text-muted-foreground">Select a cycle to inspect its recorded burndown. <Link to="/cycles" className="underline underline-offset-2">View cycles</Link></p>}
      </>}
    </div>}
  </main>;
}
