import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Button,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
  type ChartConfig,
} from '@reka/ui';
import {
  AlertCircle,
  ExternalLink,
  Maximize2,
  Minus,
  MoreHorizontal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Issue } from '@reka/types';
import type { User } from '../../../features/users/api/users.api';
import type { Project } from '../../../features/projects/api/projects.api';

type MeasureType = 'issue_count' | 'estimate';
type SliceType = 'status' | 'priority' | 'assignee' | 'project';
type SegmentType = 'priority' | 'status' | 'none';

interface IssueMetricsAsideProps {
  issues: Issue[];
  users?: User[];
  projects?: Project[];
  onClose?: () => void;
}

const PRIORITY_ORDER = ['no_priority', 'low', 'medium', 'high', 'urgent'] as const;
const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  no_priority: {
    label: 'No priority',
    color: '#737373',
    icon: <Minus className="size-3 text-muted-foreground/50" />,
  },
  low: {
    label: 'Low',
    color: '#50e3c2',
    icon: <SignalLow className="size-3.5 text-muted-foreground/60" />,
  },
  medium: {
    label: 'Medium',
    color: '#50a2ff',
    icon: <SignalMedium className="size-3.5 text-blue-500" />,
  },
  high: {
    label: 'High',
    color: '#f5a623',
    icon: <SignalHigh className="size-3.5 text-amber-500" />,
  },
  urgent: {
    label: 'Urgent',
    color: '#ff4d4d',
    icon: <AlertCircle className="size-3.5 text-rose-500" />,
  },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  triage: <span className="size-2 rounded-full bg-orange-500 shrink-0" />,
  backlog: (
    <svg className="size-3.5 text-muted-foreground shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" strokeDasharray="2 3" />
    </svg>
  ),
  todo: (
    <svg className="size-3.5 text-muted-foreground shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  ),
  in_progress: (
    <svg className="size-3.5 text-amber-500 shrink-0" viewBox="0 0 16 16" fill="none">
      <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 0 1 0 12V2Z" fill="currentColor" />
    </svg>
  ),
  in_review: (
    <svg className="size-3.5 text-blue-500 shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 2a6 6 0 1 1-6 6h6V2Z" fill="currentColor" />
    </svg>
  ),
  done: (
    <svg className="size-3.5 text-emerald-500 shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" fill="currentColor" />
      <path d="m5 8 2 2 4-4" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  canceled: (
    <svg className="size-3.5 text-muted-foreground/60 shrink-0" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.75" />
      <path d="m5.5 5.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

function formatStatusLabel(status: string) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'in_review') return 'In Review';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function IssueMetricsAside({
  issues,
  users = [],
  projects = [],
  onClose,
}: IssueMetricsAsideProps) {
  const [measure, setMeasure] = React.useState<MeasureType>('issue_count');
  const [slice, setSlice] = React.useState<SliceType>('status');
  const [segment, setSegment] = React.useState<SegmentType>('priority');

  // Compute total measure
  const totalValue = React.useMemo(() => {
    if (measure === 'estimate') {
      return issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
    }
    return issues.length;
  }, [issues, measure]);

  // Derive slice keys and labels
  const sliceItems = React.useMemo(() => {
    const map = new Map<string, { label: string; icon?: React.ReactNode; issues: Issue[] }>();

    if (slice === 'status') {
      const predefinedStatuses = ['todo', 'in_progress', 'in_review', 'done', 'backlog', 'triage', 'canceled'];
      for (const st of predefinedStatuses) {
        const matching = issues.filter((i) => i.status === st);
        if (matching.length > 0 || ['todo', 'in_progress', 'in_review'].includes(st)) {
          map.set(st, {
            label: formatStatusLabel(st),
            icon: STATUS_ICONS[st] || <span className="size-2 rounded-full bg-muted-foreground" />,
            issues: matching,
          });
        }
      }
    } else if (slice === 'priority') {
      for (const pr of PRIORITY_ORDER) {
        const matching = issues.filter((i) => (i.priority || 'no_priority') === pr);
        if (matching.length > 0) {
          map.set(pr, {
            label: PRIORITY_CONFIG[pr]?.label || pr,
            icon: PRIORITY_CONFIG[pr]?.icon,
            issues: matching,
          });
        }
      }
    } else if (slice === 'assignee') {
      const unassigned = issues.filter((i) => !i.assigneeId);
      if (unassigned.length > 0) {
        map.set('unassigned', { label: 'Unassigned', issues: unassigned });
      }
      for (const u of users) {
        const matching = issues.filter((i) => i.assigneeId === u.id);
        if (matching.length > 0) {
          map.set(u.id, { label: u.name, issues: matching });
        }
      }
    } else if (slice === 'project') {
      const noProject = issues.filter((i) => !i.projectId);
      if (noProject.length > 0) {
        map.set('no_project', { label: 'No project', issues: noProject });
      }
      for (const p of projects) {
        const matching = issues.filter((i) => i.projectId === p.id);
        if (matching.length > 0) {
          map.set(p.id, { label: p.name, issues: matching });
        }
      }
    }

    return Array.from(map.entries()).map(([key, item]) => ({
      key,
      ...item,
    }));
  }, [slice, issues, users, projects]);

  // Derive segment keys
  const segmentItems = React.useMemo(() => {
    if (segment === 'priority') {
      return PRIORITY_ORDER.map((pr) => ({
        key: pr,
        label: PRIORITY_CONFIG[pr].label,
        color: PRIORITY_CONFIG[pr].color,
        icon: PRIORITY_CONFIG[pr].icon,
      }));
    }
    if (segment === 'status') {
      return ['todo', 'in_progress', 'in_review', 'done'].map((st) => ({
        key: st,
        label: formatStatusLabel(st),
        color: st === 'todo' ? '#8f8f8f' : st === 'in_progress' ? '#f5a623' : st === 'in_review' ? '#50a2ff' : '#50e3c2',
        icon: STATUS_ICONS[st],
      }));
    }
    return [{ key: 'total', label: 'All', color: 'var(--primary)', icon: null }];
  }, [segment]);

  // Chart data and configs
  const chartConfig = React.useMemo(() => {
    const conf: ChartConfig = {};
    for (const seg of segmentItems) {
      conf[seg.key] = {
        label: seg.label,
        color: seg.color,
      };
    }
    return conf;
  }, [segmentItems]);

  const chartData = React.useMemo(() => {
    return sliceItems.map((sliceItem) => {
      const row: Record<string, any> = {
        sliceKey: sliceItem.key,
        sliceLabel: sliceItem.label,
      };

      for (const seg of segmentItems) {
        const matching = sliceItem.issues.filter((issue) => {
          if (segment === 'priority') {
            return (issue.priority || 'no_priority') === seg.key;
          }
          if (segment === 'status') {
            return issue.status === seg.key;
          }
          return true;
        });

        const val =
          measure === 'estimate'
            ? matching.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0)
            : matching.length;

        row[seg.key] = val;
      }

      return row;
    });
  }, [sliceItems, segmentItems, segment, measure]);

  // Maximum value for domain
  const maxValue = React.useMemo(() => {
    let max = 0;
    for (const row of chartData) {
      let sum = 0;
      for (const seg of segmentItems) {
        sum += (row[seg.key] as number) || 0;
      }
      if (sum > max) max = sum;
    }
    return Math.max(10, Math.ceil(max / 10) * 10);
  }, [chartData, segmentItems]);

  const handleSetDefault = () => {
    try {
      localStorage.setItem(
        'reka:issues:metrics-default',
        JSON.stringify({ measure, slice, segment }),
      );
    } catch {
      // ignore
    }
    toast.success('Metrics configuration saved as default');
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-card text-foreground select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/70 p-4 shrink-0">
        <div className="flex items-baseline">
          <span className="text-xl font-bold tracking-tight text-foreground">{totalValue}</span>
          <span className="ml-1.5 text-xs text-muted-foreground font-normal">
            {measure === 'estimate' ? 'estimate points' : 'issues'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground">
          <Button
            asChild
            variant="ghost"
            size="icon-xs"
            className="hover:text-foreground"
            title="Open in Insights"
            aria-label="Open in Insights"
          >
            <Link to="/insights">
              <Maximize2 className="size-3.5" />
            </Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="hover:text-foreground"
            title="Configure metrics"
            aria-label="Configure metrics"
            onClick={() => {
              setSegment((cur) => (cur === 'priority' ? 'status' : cur === 'status' ? 'none' : 'priority'));
            }}
          >
            <SlidersHorizontal className="size-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="hover:text-foreground"
                title="Metrics actions"
                aria-label="Metrics actions"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={handleSetDefault}>
                  Set as default
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/insights">
                    <ExternalLink data-icon="inline-start" />
                    Full Insights
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              className="hover:text-foreground ml-1"
              title="Close metrics"
              aria-label="Close metrics"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Selectors Bar (Measure, Slice, Segment) */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b border-border/70 shrink-0">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          <span>Measure</span>
          <select
            aria-label="Measure"
            value={measure}
            onChange={(e) => setMeasure(e.target.value as MeasureType)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="issue_count">Issue count</option>
            <option value="estimate">Estimate</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          <span>Slice</span>
          <select
            aria-label="Slice"
            value={slice}
            onChange={(e) => setSlice(e.target.value as SliceType)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
            <option value="project">Project</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
          <span>Segment</span>
          <select
            aria-label="Segment"
            value={segment}
            onChange={(e) => setSegment(e.target.value as SegmentType)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="priority">Priority</option>
            <option value="status">Status</option>
            <option value="none">None</option>
          </select>
        </label>
      </div>

      {/* Stacked Bar Chart */}
      <div className="p-4 shrink-0 min-h-[220px]">
        <ChartContainer config={chartConfig} className="h-48 w-full aspect-auto" aria-label="Metrics stacked bar chart">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 12, right: 24, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="2 3"
              stroke="var(--border)"
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="sliceLabel"
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            />
            <YAxis
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              allowDecimals={false}
              domain={[0, maxValue]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {segmentItems.map((seg, index) => (
              <Bar
                key={seg.key}
                dataKey={seg.key}
                name={seg.label}
                stackId="stack"
                fill={seg.color}
                barSize={10}
                radius={index === segmentItems.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-x-auto border-t border-border/70">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border/70 text-muted-foreground bg-muted/20">
              <th scope="col" className="p-2.5 pl-4 font-medium capitalize">
                {slice}
              </th>
              <th scope="col" className="p-2.5 font-medium tabular-nums text-right">
                {measure === 'estimate' ? 'Estimate' : 'Issue count'}
              </th>
              {segment !== 'none' &&
                segmentItems.map((seg) => (
                  <th
                    key={seg.key}
                    scope="col"
                    className="p-2.5 font-medium tabular-nums text-right whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      {seg.icon}
                      <span>{seg.label}</span>
                    </span>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sliceItems.map((item) => {
              const row = chartData.find((d) => d.sliceKey === item.key);
              let rowTotal = 0;
              for (const seg of segmentItems) {
                rowTotal += (row?.[seg.key] as number) || 0;
              }

              return (
                <tr key={item.key} className="hover:bg-muted/40 transition-colors">
                  <td className="p-2.5 pl-4 font-normal">
                    <span className="inline-flex items-center gap-2">
                      {item.icon}
                      <span className="truncate max-w-[120px] font-medium">{item.label}</span>
                    </span>
                  </td>
                  <td className="p-2.5 text-right tabular-nums text-foreground font-medium">
                    {rowTotal}
                  </td>
                  {segment !== 'none' &&
                    segmentItems.map((seg) => {
                      const val = row?.[seg.key] ?? 0;
                      return (
                        <td
                          key={seg.key}
                          className="p-2.5 text-right tabular-nums text-muted-foreground"
                        >
                          {val}
                        </td>
                      );
                    })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end border-t border-border/70 p-3 shrink-0">
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={handleSetDefault}
          className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
        >
          Set default for everyone
        </Button>
      </div>
    </div>
  );
}
