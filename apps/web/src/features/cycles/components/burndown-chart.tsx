import * as React from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Button, ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@reka/ui';
import type { CycleSnapshot } from '../api/cycles.api';

type Metric = 'issues' | 'estimate';
const config = {
  remaining: { label: 'Measured remaining', color: 'var(--foreground)' },
} satisfies ChartConfig;

export function buildBurndownData(snapshots: CycleSnapshot[], metric: Metric) {
  return snapshots.map(snapshot => ({
    time: new Date(snapshot.snapshotAt).getTime(),
    remaining: metric === 'issues' ? snapshot.remainingIssueCount : snapshot.remainingEstimate,
  })).filter(point => Number.isFinite(point.time)).sort((a, b) => a.time - b.time);
}

export function BurndownChart({ snapshots, isLoading, isError, onRetry }: {
  snapshots: CycleSnapshot[]; isLoading?: boolean; isError?: boolean; onRetry?: () => void;
}) {
  const [metric, setMetric] = React.useState<Metric>('issues');
  const data = buildBurndownData(snapshots, metric);
  const earliest = data[0]?.time;
  const latest = data[data.length - 1]?.time;
  const remaining = data.at(-1)?.remaining;
  return <section className="flex min-w-0 flex-col gap-4 border-b border-border pb-5" aria-label="Measured cycle burndown">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1"><h2 className="text-sm font-medium">Delivery history</h2><p className="text-xs text-muted-foreground">Recorded snapshots only. History starts when tracking begins; earlier values are not reconstructed.</p></div>
      <div className="flex items-center gap-1" aria-label="Burndown metric">
        <Button size="sm" variant="category" aria-pressed={metric === 'issues'} onClick={() => setMetric('issues')}>Issues</Button>
        <Button size="sm" variant="category" aria-pressed={metric === 'estimate'} onClick={() => setMetric('estimate')}>Estimate</Button>
      </div>
    </div>
    {isLoading ? <div role="status" aria-label="Loading cycle history" className="h-48 animate-pulse rounded-md bg-muted/50" /> : isError ? <div role="alert" className="flex items-center gap-3 text-sm text-muted-foreground">Could not load history.<Button variant="outline" size="sm" onClick={onRetry}>Retry</Button></div> : data.length ? <>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{earliest ? `History from ${new Date(earliest).toLocaleString()}` : ''}</span><span className="tabular-nums">{remaining} remaining at last snapshot</span></div>
      <div className="h-48 w-full min-w-0">
        <ChartContainer config={config} className="h-full w-full aspect-auto">
          <LineChart accessibilityLayer data={data} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} scale="time" tickLine={false} axisLine={false} minTickGap={30} tickFormatter={time => new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
            <YAxis tickLine={false} axisLine={false} domain={[0, 'auto']} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent labelFormatter={value => new Date(Number(value)).toLocaleString()} />} />
            <Line dataKey="remaining" name={metric === 'issues' ? 'Remaining issues' : 'Remaining estimate'} type="monotone" stroke="var(--foreground)" strokeWidth={2} dot={{ r: 3, fill: 'var(--foreground)', stroke: 'var(--background)', strokeWidth: 1 }} isAnimationActive={false} />
          </LineChart>
        </ChartContainer>
      </div>
      {earliest && latest && latest - earliest < 6 * 60 * 60 * 1000 && <p className="text-xs text-muted-foreground">Only one sampling window is recorded so far; a trend needs more history.</p>}
    </> : <div className="flex min-h-32 flex-col justify-center gap-1 rounded-md border border-dashed border-border p-4"><p className="text-sm font-medium">No delivery history yet</p><p className="text-xs text-muted-foreground">The worker records a sample every six hours while the cycle is active and captures a final sample when it closes. No past history is fabricated.</p></div>}
  </section>;
}
