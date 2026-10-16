import * as React from 'react';
import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Alert, AlertDescription, Button, ChartContainer, ChartTooltip, ChartTooltipContent, Skeleton, type ChartConfig } from '@reka/ui';
import { Triangle } from 'lucide-react';
import { useCycleHistory } from '../hooks/use-cycles';
import { useTeamWorkflowStates } from '../../teams/hooks/use-teams';
import type { Cycle, CycleSnapshot } from '../api/cycles.api';

const config = {
  scope: { label: 'Scope', color: 'var(--cycle-scope)' },
  started: { label: 'Started (current)', color: 'var(--cycle-started)' },
  completed: { label: 'Completed', color: 'var(--cycle-completed)' },
  guide: { label: 'Schedule guide (not a forecast)', color: 'var(--cycle-completed)' },
} satisfies ChartConfig;
const DAY = 86_400_000;
const shortDate = (value: number) => new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });

type Point = { time: number; scope?: number; started?: number; completed?: number; guide: number };

// The guide is a visual schedule target, never a reconstructed delivery history.
export function buildCycleProgressData(cycle: Cycle, snapshots: CycleSnapshot[], now: number, started: number | null): Point[] {
  const start = new Date(cycle.startDate).getTime(), end = new Date(cycle.endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const observed = snapshots.map(snapshot => ({ time: new Date(snapshot.snapshotAt).getTime(), scope: snapshot.totalIssueCount, completed: snapshot.completedIssueCount }))
    .filter(point => Number.isFinite(point.time) && point.time >= start && point.time <= end);
  const points = new Map<number, Omit<Point, 'guide'>>([[start, { time: start }], [end, { time: end }]]);
  for (const point of observed) points.set(point.time, point);
  if (cycle.status === 'active' && now >= start && now <= end) {
    points.set(now, { time: now, scope: cycle.totalIssues, completed: cycle.completedIssues, ...(started === null ? {} : { started }) });
  }
  return [...points.values()].sort((a, b) => a.time - b.time).map(point => ({ ...point, guide: (cycle.totalIssues ?? 0) * (point.time - start) / (end - start) }));
}

function weekendRanges(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start > 90 * DAY) return [];
  const ranges: [number, number][] = [];
  const date = new Date(start); date.setHours(0, 0, 0, 0);
  while (date.getTime() < end) {
    const next = new Date(date); next.setDate(next.getDate() + 1);
    if (date.getDay() === 6 || date.getDay() === 0) ranges.push([Math.max(start, date.getTime()), Math.min(end, next.getTime())]);
    date.setTime(next.getTime());
  }
  return ranges;
}

export function CycleProgressChart({ cycle }: { cycle: Cycle }) {
  const history = useCycleHistory(cycle.id);
  const workflow = useTeamWorkflowStates(cycle.issues?.length ? cycle.teamId : undefined);
  const patternId = `cycle-weekend-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const now = Date.now();
  const start = new Date(cycle.startDate).getTime(), end = new Date(cycle.endDate).getTime();
  const started = cycle.totalIssues === 0 ? 0 : cycle.issues && workflow.data
    ? cycle.issues.filter(issue => (issue.statusCategory ?? workflow.data.find(state => state.key === issue.status)?.category) === 'started').length : null;
  const data = buildCycleProgressData(cycle, history.data?.snapshots ?? [], now, started);
  const total = cycle.totalIssues ?? 0;
  const stats = [
    { key: 'scope', name: 'Scope', value: cycle.totalIssues, percent: false },
    { key: 'started', name: 'Started', value: started, percent: true },
    { key: 'completed', name: 'Completed', value: cycle.completedIssues, percent: true },
  ];
  const ticks = Number.isFinite(start) && Number.isFinite(end) ? [start, start + (end - start) / 3, start + (end - start) * 2 / 3, end] : [];
  return <section aria-label={`Progress for ${cycle.name || `Cycle ${cycle.number}`}`} className="cycle-progress flex min-w-0 flex-col gap-4">
    <div className="cycle-progress-layout">
      <div className="min-w-0">
        {history.isLoading ? <Skeleton role="status" aria-label="Loading cycle progress" className="h-44 w-full" /> : history.isError ? <Alert variant="destructive"><AlertDescription>Could not load cycle history.<Button variant="outline" size="sm" onClick={() => void history.refetch()}>Retry history</Button></AlertDescription></Alert> : <>
          <ChartContainer config={config} className="h-44 w-full aspect-auto" aria-label="Cycle scope and completed issues over time">
            <ComposedChart accessibilityLayer data={data} margin={{ top: 16, left: 8, right: 12, bottom: 0 }}>
              <defs><pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="2" /></pattern></defs>
              <XAxis dataKey="time" type="number" domain={[start, end]} ticks={ticks} scale="time" tickFormatter={shortDate} tickLine={{ stroke: 'var(--muted-foreground)' }} axisLine={false} interval="preserveStartEnd" minTickGap={24} tickMargin={8} />
              <YAxis hide domain={[0, Math.max(1, total, ...data.map(point => point.scope ?? 0))]} />
              {weekendRanges(start, end).map(([from, to]) => <ReferenceArea key={from} x1={from} x2={to} fill={`url(#${patternId})`} fillOpacity={1} />)}
              {cycle.status === 'active' && now >= start && now <= end && <ReferenceLine x={now} stroke="var(--border)" />}
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, payload) => payload[0]?.payload?.time ? new Date(payload[0].payload.time).toLocaleString() : ''} />} />
              <Area dataKey="scope" type="stepAfter" stroke="var(--color-scope)" fill="var(--color-scope)" fillOpacity={0.05} strokeWidth={1.5} connectNulls dot={{ r: 2 }} isAnimationActive={false} />
              <Line dataKey="guide" type="linear" stroke="var(--color-guide)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line dataKey="completed" type="linear" stroke="var(--color-completed)" strokeWidth={1.5} connectNulls dot={{ r: 3, fill: 'var(--color-completed)', strokeWidth: 0 }} isAnimationActive={false} />
              <Line dataKey="started" stroke="var(--color-started)" dot={{ r: 3, fill: 'var(--color-started)', strokeWidth: 0 }} isAnimationActive={false} />
            </ComposedChart>
          </ChartContainer>
          {!history.data?.snapshots?.length && <p className="mt-2 text-xs text-muted-foreground">No delivery history yet.{cycle.status === 'active' ? ' Showing current values only.' : ''}</p>}
        </>}
      </div>
      <dl aria-label="Cycle progress summary" className="flex min-w-0 flex-col divide-y divide-border">
        {stats.map(stat => <div key={stat.key} className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm">
          <dt className="inline-flex items-center gap-3 text-muted-foreground"><span aria-hidden="true" className="size-1.5 rounded-[1px]" style={{ backgroundColor: `var(--cycle-${stat.key})` }} />{stat.name}</dt>
          <dd className="inline-flex items-center gap-1.5 tabular-nums"><Triangle aria-hidden="true" className="size-3.5 text-muted-foreground" />{stat.value == null ? <span className="text-muted-foreground">Not available</span> : <><span>{stat.value}</span>{stat.percent && <span className="text-muted-foreground">· {total ? Math.round(stat.value / total * 100) : 0}%</span>}</>}</dd>
        </div>)}
      </dl>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <p>Scope and completed history use recorded samples. Started is current only. Dashed line: schedule guide, not a forecast.</p>
      {workflow.isError && <Button size="sm" variant="outline" onClick={() => void workflow.refetch()}>Retry workflow</Button>}
    </div>
  </section>;
}
