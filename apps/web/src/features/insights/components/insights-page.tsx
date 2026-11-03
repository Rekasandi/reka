import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Input, Skeleton, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Alert, Spinner, FieldDescription } from '@reka/ui';
import { AlertCircle, RefreshCw, BarChart3, Timer, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SelectField, type SelectFieldOption } from '../../../components/common/select-field';
import { getCycleInsights, getInsightsOverview } from '../api/insights.api';
import { useTeams } from '../../teams/hooks/use-teams';
import { useProjects } from '../../projects/hooks/use-projects';
import { useCycles } from '../../cycles/hooks/use-cycles';

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
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: SelectFieldOption[] }) {
  const id = React.useId();
  return <Label htmlFor={id} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>{label}</span><SelectField id={id} value={value} onValueChange={onChange} options={options} className="w-full min-w-0" /></Label>;
}
function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof BarChart3 }) {
  return <section className="flex min-w-0 flex-col gap-2 border-l border-border pl-4 first:border-l-0 first:pl-0 sm:pl-5"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" />{label}</div><div className="text-xl font-semibold tabular-nums tracking-tight">{value}</div><p className="text-xs leading-5 text-muted-foreground">{detail}</p></section>;
}
function QueryState({ loading, error, retry }: { loading: boolean; error: boolean; retry: () => void }) {
  if (loading) return <div className="space-y-2 py-2"><Spinner aria-label="Loading insights" className="sr-only" /><Skeleton className="h-9 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (error) return <Alert className="rounded-none border-0 bg-transparent px-0 py-0 text-foreground flex flex-wrap items-center gap-3 py-8 text-sm text-muted-foreground"><AlertCircle className="size-4 text-destructive" />Could not load report data.<Button variant="outline" size="sm" onClick={retry}><RefreshCw data-icon="inline-start" />Retry</Button></Alert>;
  return null;
}

export function InsightsPage() {
  const [tab, setTab] = React.useState<'issues' | 'cycles'>('issues');
  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(() => localDay(new Date()));
  const [timezone, setTimezone] = React.useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [teamId, setTeamId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [cycleId, setCycleId] = React.useState('');
  const [unit, setUnit] = React.useState<'issues' | 'estimate'>('issues');
  const [page, setPage] = React.useState(1);
  const teamsQuery = useTeams(); const projectsQuery = useProjects(); const cyclesQuery = useCycles();
  const teams = teamsQuery.data ?? []; const projects = projectsQuery.data ?? []; const cycles = cyclesQuery.data ?? [];
  const visibleProjects = projects.filter(project => !teamId || project.teamId === teamId);
  const visibleCycles = cycles.filter(cycle => !teamId || cycle.teamId === teamId);
  const baseFilters = { from, to, timezone, ...(teamId ? { teamId } : {}) };
  const overviewFilters = { ...baseFilters, ...(projectId ? { projectId } : {}), page, pageSize: 20 };
  const overview = useQuery({ queryKey: ['insights-overview', overviewFilters], queryFn: () => getInsightsOverview(overviewFilters), enabled: tab === 'issues' });
  const cycleMetrics = useQuery({ queryKey: ['insights-cycles', baseFilters, cycleId, unit], queryFn: () => getCycleInsights({ ...baseFilters, ...(cycleId ? { cycleId } : {}), unit }), enabled: tab === 'cycles' });
  const changeTeam = (value: string) => { setTeamId(value); setProjectId(''); setCycleId(''); setPage(1); };
  const resetPage = (action: () => void) => { action(); setPage(1); };

  return <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-12">
    <header className="flex flex-col gap-1"><div className="flex flex-wrap items-center gap-2.5"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Insights</h1><Badge variant="outline">Reports</Badge></div><p className="text-xs text-muted-foreground">Delivery metrics from recorded workflow and cycle history.</p></header>
    <nav aria-label="Insight reports" className="flex gap-1 border-b border-border">
      <Button variant="category" size="sm" aria-pressed={tab === 'issues'} onClick={() => setTab('issues')}><BarChart3 data-icon="inline-start" />Issue trends</Button>
      <Button variant="category" size="sm" aria-pressed={tab === 'cycles'} onClick={() => setTab('cycles')}><RotateCcw data-icon="inline-start" />Cycle delivery</Button>
    </nav>
    <section aria-label="Report filters" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>From</span><Input type="date" value={from} max={to} onChange={event => resetPage(() => setFrom(event.target.value))} /></Label>
      <Label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>To</span><Input type="date" value={to} min={from} onChange={event => resetPage(() => setTo(event.target.value))} /></Label>
      <FilterSelect label="Team" value={teamId} onChange={changeTeam} options={[{ value: '', label: 'All accessible teams' }, ...teams.map(team => ({ value: team.id, label: `${team.key} · ${team.name}` }))]} />
      {tab === 'issues' ? <>
        <FilterSelect label="Project" value={projectId} onChange={value => resetPage(() => setProjectId(value))} options={[{ value: '', label: 'All projects' }, ...visibleProjects.map(project => ({ value: project.id, label: project.name }))]} />
      </> : <>
        <FilterSelect label="Cycle" value={cycleId} onChange={setCycleId} options={[{ value: '', label: 'Team velocity' }, ...visibleCycles.map(cycle => ({ value: cycle.id, label: cycle.name || `Cycle ${cycle.number}` }))]} />
        <FilterSelect label="Unit" value={unit} onChange={value => setUnit(value as 'issues' | 'estimate')} options={[{ value: 'issues', label: 'Issue count' }, { value: 'estimate', label: 'Estimate points' }]} />
      </>}
      <Label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"><span>Timezone</span><Input aria-label="Report timezone" value={timezone} onChange={event => resetPage(() => setTimezone(event.target.value))} list="insight-timezones" /><datalist id="insight-timezones"><option value="UTC" /><option value="America/Los_Angeles" /><option value="America/New_York" /><option value="Europe/London" /><option value="Asia/Jakarta" /></datalist></Label>
    </section>

    {tab === 'issues' && <div className="flex flex-col gap-6">
      <QueryState loading={overview.isLoading} error={overview.isError} retry={() => overview.refetch()} />
      {overview.data && <>
        {!overview.data.history.hasHistory && <FieldDescription role="status" className="border-l-2 border-border pl-3 text-sm text-muted-foreground">No instrumented issue history is available for these teams yet. Earlier durations are not inferred.</FieldDescription>}
        <section aria-label="Issue metrics" className="grid grid-cols-2 gap-y-5 border-y border-border py-4 sm:grid-cols-4">
          <Metric label="Throughput" value={String(overview.data.throughput.total)} detail={`${overview.data.throughput.repeatedCompletionEvents} later re-completion event${overview.data.throughput.repeatedCompletionEvents === 1 ? '' : 's'} excluded`} icon={BarChart3} />
          <Metric label="Average lead time" value={formatHours(overview.data.leadTime.averageHours)} detail={`${overview.data.leadTime.sampleSize} measured · ${overview.data.leadTime.missingHistoryCount} missing create history`} icon={Timer} />
          <Metric label="Median lead time" value={formatHours(overview.data.leadTime.medianHours)} detail="Creation to first completed status" icon={Timer} />
          <Metric label="Average cycle time" value={formatHours(overview.data.cycleTime.averageHours)} detail={`${overview.data.cycleTime.sampleSize} measured · ${overview.data.cycleTime.missingHistoryCount} missing start history`} icon={RotateCcw} />
        </section>
        <section className="flex flex-col gap-3">
          <div><h2 className="text-sm font-semibold">Daily throughput</h2><p className="text-xs text-muted-foreground">First recorded transition into a completed category per issue. For {overview.data.throughput.baselineCompletionCount} baseline completion(s), earlier completion history is unknown.</p></div>
          <div className="overflow-x-auto rounded-md border border-border"><Table className="w-full min-w-[360px] text-left text-xs"><TableHeader className="bg-muted/40 text-muted-foreground"><TableRow><TableHead scope="col" className="px-3 py-2 font-medium">Local date</TableHead><TableHead scope="col" className="px-3 py-2 text-right font-medium">Completed issues</TableHead></TableRow></TableHeader><TableBody className="divide-y divide-border">{overview.data.throughput.points.map(point => <TableRow key={point.date}><TableHead scope="row" className="px-3 py-2 font-normal">{point.date}</TableHead><TableCell className="px-3 py-2 text-right tabular-nums">{point.count}</TableCell></TableRow>)}</TableBody></Table></div>
        </section>
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-semibold">Completed issues</h2><p className="text-xs text-muted-foreground">{overview.data.completions.total} first completions in the selected filters.</p></div><span className="text-xs text-muted-foreground">Page {overview.data.completions.page} of {Math.max(1, overview.data.completions.totalPages)}</span></div>
          {overview.data.completions.rows.length ? <div className="overflow-x-auto rounded-md border border-border"><Table className="w-full min-w-[540px] text-left text-xs"><TableHeader className="bg-muted/40 text-muted-foreground"><TableRow><TableHead scope="col" className="px-3 py-2 font-medium">Issue</TableHead><TableHead scope="col" className="px-3 py-2 font-medium">Title</TableHead><TableHead scope="col" className="px-3 py-2 text-right font-medium">Completed</TableHead></TableRow></TableHeader><TableBody className="divide-y divide-border">{overview.data.completions.rows.map(row => <TableRow key={row.issueId}><TableCell className="px-3 py-2 font-mono">{row.identifier || 'Issue'}</TableCell><TableCell className="max-w-[36rem] truncate px-3 py-2">{row.title || 'Untitled issue'}</TableCell><TableCell className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">{formatDate(row.completedAt, timezone)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="border-y border-border py-6 text-center text-sm text-muted-foreground">No completed issues match this report.</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || overview.isFetching} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</Button><Button variant="outline" size="sm" disabled={page >= overview.data.completions.totalPages || overview.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></div>
        </section>
        <p className="text-xs leading-5 text-muted-foreground">{overview.data.quality.explanation} {overview.data.history.baselineIssueCount} legacy baseline issue histories are unmeasured.</p>
      </>}
    </div>}

    {tab === 'cycles' && <div className="flex flex-col gap-6">
      <QueryState loading={cycleMetrics.isLoading} error={cycleMetrics.isError} retry={() => cycleMetrics.refetch()} />
      {cycleMetrics.data && <>
        <section className="flex flex-col gap-3"><div><h2 className="text-sm font-semibold">Cycle velocity</h2><p className="text-xs text-muted-foreground">Final recorded snapshots from completed cycles in this window.</p></div>
          {cycleMetrics.data.velocity.points.length ? <div className="overflow-x-auto rounded-md border border-border"><Table className="w-full min-w-[520px] text-left text-xs"><TableHeader className="bg-muted/40 text-muted-foreground"><TableRow><TableHead scope="col" className="px-3 py-2 font-medium">Cycle</TableHead><TableHead scope="col" className="px-3 py-2 text-right font-medium">Completed {unit === 'issues' ? 'issues' : 'points'}</TableHead><TableHead scope="col" className="px-3 py-2 text-right font-medium">Missing estimates</TableHead><TableHead scope="col" className="px-3 py-2 text-right font-medium">Recorded</TableHead></TableRow></TableHeader><TableBody className="divide-y divide-border">{cycleMetrics.data.velocity.points.map(point => <TableRow key={point.cycleId}><TableHead scope="row" className="px-3 py-2 font-medium">{point.cycleName}</TableHead><TableCell className="px-3 py-2 text-right tabular-nums">{point.value}</TableCell><TableCell className="px-3 py-2 text-right tabular-nums">{point.missingEstimateCount}</TableCell><TableCell className="px-3 py-2 text-right text-muted-foreground">{formatDate(point.measuredAt, timezone)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="border-y border-border py-6 text-sm text-muted-foreground">No completed cycle with a final snapshot was recorded in this window.</p>}
          {cycleMetrics.data.velocity.unmeasuredCompletedCycles > 0 && <p className="text-xs text-muted-foreground">{cycleMetrics.data.velocity.unmeasuredCompletedCycles} completed cycle(s) in scope have no recorded snapshots and are excluded.</p>}
          {cycleMetrics.data.velocity.scopeTruncated && <p className="text-xs text-muted-foreground">Showing the 500 most recently started cycles in scope. Narrow by team for complete coverage.</p>}
        </section>
        {cycleId ? <section className="flex flex-col gap-3"><div><h2 className="text-sm font-semibold">Burndown samples</h2><p className="text-xs text-muted-foreground">Recorded remaining work only; no interpolated history.</p></div>
          {cycleMetrics.data.burndown.hasHistory ? <div className="overflow-x-auto rounded-md border border-border"><Table className="w-full min-w-[620px] text-left text-xs"><TableHeader className="bg-muted/40 text-muted-foreground"><TableRow><TableHead scope="col" className="px-3 py-2 font-medium">Recorded at</TableHead><TableHead scope="col" className="px-3 py-2 text-right font-medium">Remaining {unit === 'issues' ? 'issues' : 'points'}</TableHead><TableHead scope="col" className="px-3 py-2 text-right font-medium">Completed issues</TableHead><TableHead scope="col" className="px-3 py-2 text-right font-medium">Missing estimates</TableHead></TableRow></TableHeader><TableBody className="divide-y divide-border">{cycleMetrics.data.burndown.points.map(point => <TableRow key={point.snapshotAt}><TableHead scope="row" className="px-3 py-2 font-normal">{new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(point.snapshotAt))}</TableHead><TableCell className="px-3 py-2 text-right tabular-nums">{point.value}</TableCell><TableCell className="px-3 py-2 text-right tabular-nums">{point.completedIssueCount}</TableCell><TableCell className="px-3 py-2 text-right tabular-nums">{point.missingEstimateCount}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="border-y border-border py-6 text-sm text-muted-foreground">{cycleMetrics.data.quality.message}</p>}
          {cycleMetrics.data.burndown.hasHistory && <p className="text-xs text-muted-foreground">{cycleMetrics.data.quality.message}</p>}
        </section> : <p className="text-xs text-muted-foreground">Select a cycle to inspect its recorded burndown. <Link to="/cycles" className="underline underline-offset-2">View cycles</Link></p>}
      </>}
    </div>}
  </main>;
}
