import * as React from 'react';
import {
  AreaChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@reka/ui';

interface BurndownChartProps {
  startDate: string;
  endDate: string;
  totalIssues: number;
  completedIssues: number;
}

const chartConfig = {
  ideal: {
    label: 'Ideal Burndown',
    color: '#71717a',
  },
  actual: {
    label: 'Actual Remaining',
    color: '#10b981',
  },
} satisfies ChartConfig;

export function BurndownChart({
  startDate,
  endDate,
  totalIssues,
  completedIssues,
}: BurndownChartProps) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();

  const totalDays = Math.max(Math.round((end - start) / (1000 * 60 * 60 * 24)), 1);
  const currentElapsedDays = Math.min(
    Math.max(Math.round((now - start) / (1000 * 60 * 60 * 24)), 0),
    totalDays,
  );

  // Generate day-by-day sprint burn points
  const chartData = React.useMemo(() => {
    const data = [];
    const actualRemaining = Math.max(totalIssues - completedIssues, 0);

    for (let day = 0; day <= totalDays; day++) {
      const currentDate = new Date(start + day * 24 * 60 * 60 * 1000);
      const dayLabel = currentDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Ideal: linear decrement from total to 0
      const idealVal = Math.max(Math.round(totalIssues - (totalIssues / totalDays) * day), 0);

      // Actual: interpolated trajectory up to current elapsed day
      let actualVal: number | null = null;
      if (day <= currentElapsedDays) {
        if (currentElapsedDays === 0) {
          actualVal = totalIssues;
        } else {
          // Gradual progress curve leading up to current remaining
          const factor = day / currentElapsedDays;
          actualVal = Math.round(totalIssues - (totalIssues - actualRemaining) * factor);
        }
      }

      data.push({
        day: dayLabel,
        ideal: idealVal,
        actual: actualVal,
      });
    }

    return data;
  }, [start, totalDays, currentElapsedDays, totalIssues, completedIssues]);

  const actualRemainingNow = Math.max(totalIssues - completedIssues, 0);

  return (
    <div className="rounded-[14px] border border-border/80 bg-card/40 p-5 flex flex-col gap-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Sprint Burndown Chart
          </span>
          <span className="font-mono text-[11px] text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.2 rounded-[4px]">
            {actualRemainingNow} remaining
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-0.5 w-3.5 border-t border-dashed border-muted-foreground/70 inline-block" />
            <span>Ideal</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
            <span className="size-2 rounded-full bg-emerald-500 inline-block" />
            <span>Actual</span>
          </div>
        </div>
      </div>

      {/* Recharts Chart Container adhering to shadcn v3 standards */}
      <div className="w-full min-h-[180px] h-[190px]">
        <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
          <AreaChart accessibilityLayer data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />

            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
              domain={[0, Math.max(totalIssues, 5)]}
              allowDecimals={false}
            />

            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />

            {/* Ideal Line (Dashed) */}
            <Line
              type="monotone"
              dataKey="ideal"
              stroke="#71717a"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />

            {/* Actual Area + Line (Emerald) */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#fillActual)"
              dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#10b981', stroke: 'var(--background)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      </div>

      <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground pt-2 border-t border-border/50">
        <span>Start: {new Date(startDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span>Sprint Velocity: {completedIssues} issues delivered</span>
        <span>End: {new Date(endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
    </div>
  );
}
