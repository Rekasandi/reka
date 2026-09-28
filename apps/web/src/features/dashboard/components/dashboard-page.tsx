import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
} from '@reka/ui';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  GitPullRequest,
  Plus,
  ArrowRight,
  TrendingUp,
  FolderKanban,
  RotateCcw,
  Inbox as InboxIcon,
  ChevronRight,
  Activity,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useIssues } from '../../issues/hooks/use-issues';
import { useProjects } from '../../projects/hooks/use-projects';
import { useCycles } from '../../cycles/hooks/use-cycles';
import { useUnreadCount } from '../../notifications/hooks/use-notifications';
import { useWorkspaceActivities } from '../../issues/hooks/use-issue-details';
import { useAuthStore } from '../../../stores/auth.store';
import { useTheme } from '../../../components/theme/theme-provider';
import { PriorityIcon } from '../../issues/components/issue-list-view';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import type { Issue } from '@reka/types';

// Register Chart.js components (restrained, single line engine)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export function DashboardPage() {
  const { user } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [velocityRange, setVelocityRange] = React.useState<'7d' | '14d' | 'cycle'>('7d');

  // Queries
  const { data: issues = [] } = useIssues();
  const { data: projects = [] } = useProjects();
  const { data: cycles = [] } = useCycles();
  const { data: unreadData } = useUnreadCount();
  const { data: activities = [] } = useWorkspaceActivities(8);

  const handleOpenIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDetailOpen(true);
  };

  // Metrics
  const myWorkIssues = React.useMemo(() => {
    if (!user) return issues.filter((i) => i.status !== 'done' && i.status !== 'canceled');
    const assigned = issues.filter(
      (i) => i.assigneeId === user.id && i.status !== 'done' && i.status !== 'canceled',
    );
    return assigned.length > 0
      ? assigned
      : issues.filter((i) => i.status === 'in_progress' || i.status === 'todo');
  }, [issues, user]);

  const urgentOrBlockedIssues = React.useMemo(() => {
    return issues.filter(
      (i) =>
        (i.priority === 'urgent' || i.status === 'blocked') &&
        i.status !== 'done' &&
        i.status !== 'canceled',
    );
  }, [issues]);

  const currentCycle = cycles.length > 0 ? cycles[0] : null;

  const doneCount = issues.filter((i) => i.status === 'done').length;
  const cycleCompletionRate =
    issues.length > 0 ? Math.round((doneCount / issues.length) * 100) : 74;

  // Chart styling colors based on Geist tokens
  const textColor = isDark ? '#8f8f8f' : '#888888';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
  const tooltipBg = isDark ? '#171717' : '#ffffff';
  const tooltipText = isDark ? '#ffffff' : '#171717';
  const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : '#ebebeb';

  // Sprint Velocity & Burnup Chart Data
  const velocityData = React.useMemo(() => {
    const labels =
      velocityRange === '7d'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : velocityRange === '14d'
        ? ['W1 Mon', 'W1 Wed', 'W1 Fri', 'W1 Sun', 'W2 Tue', 'W2 Thu', 'W2 Sat']
        : ['Day 1', 'Day 3', 'Day 6', 'Day 8', 'Day 10', 'Day 12', 'Day 14'];

    const completed =
      velocityRange === '7d'
        ? [3, 5, 4, 8, 11, 9, 14]
        : velocityRange === '14d'
        ? [4, 8, 12, 17, 21, 26, 32]
        : [2, 6, 11, 16, 22, 27, 33];

    const targetScope =
      velocityRange === '7d'
        ? [16, 16, 16, 16, 16, 16, 16]
        : velocityRange === '14d'
        ? [36, 36, 36, 36, 36, 36, 36]
        : [35, 35, 35, 35, 35, 35, 35];

    return {
      labels,
      datasets: [
        {
          label: 'Completed Throughput',
          data: completed,
          borderColor: '#0070f3',
          backgroundColor: isDark ? 'rgba(0, 112, 243, 0.08)' : 'rgba(0, 112, 243, 0.04)',
          fill: true,
          tension: 0.3,
          borderWidth: 1.5,
          pointRadius: 2.5,
          pointHoverRadius: 4,
          pointBackgroundColor: '#0070f3',
        },
        {
          label: 'Committed Scope',
          data: targetScope,
          borderColor: isDark ? '#333333' : '#e0e0e0',
          borderDash: [3, 3],
          backgroundColor: 'transparent',
          tension: 0.1,
          borderWidth: 1,
          pointRadius: 0,
        },
      ],
    };
  }, [velocityRange, isDark]);

  const velocityOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: textColor,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          font: { family: 'Geist, sans-serif', size: 12 },
        },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 8,
        cornerRadius: 4,
        bodyFont: { family: 'Geist Mono, monospace', size: 12 },
        titleFont: { family: 'Geist, sans-serif', size: 12, weight: 600 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { family: 'Geist Mono, monospace', size: 12 } },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { family: 'Geist Mono, monospace', size: 12 }, stepSize: 4 },
      },
    },
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-emerald-500';
      case 'in_progress':
        return 'bg-amber-500';
      case 'in_review':
        return 'bg-purple-500';
      case 'blocked':
        return 'bg-rose-500';
      default:
        return 'bg-muted-foreground/50';
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Top Workspace Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {user?.name ? `${user.name}’s Workspace` : 'Engineering Workspace'}
            </h1>
            <span className="font-mono text-xs text-muted-foreground bg-muted/60 border border-border px-1.5 py-0.5 rounded-[4px]">
              {currentCycle?.name || 'Sprint 12'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Personal triage queue, active sprint throughput, and delivery stream health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-7 text-xs gap-1.5 rounded-[6px]"
          >
            <Link to="/inbox">
              <InboxIcon className="size-3.5" />
              <span>Inbox</span>
              {unreadData && unreadData.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-mono">
                  {unreadData.count}
                </span>
              )}
            </Link>
          </Button>

          <Button
            size="sm"
            className="h-7 text-xs gap-1.5 rounded-[6px]"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            <span>New Issue</span>
            <kbd className="hidden sm:inline font-mono text-xs opacity-60 ml-0.5">C</kbd>
          </Button>
        </div>
      </div>

      {/* Clean Hairline Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-border/80 rounded-lg bg-card/40 divide-x divide-y md:divide-y-0 divide-border/60 overflow-hidden">
        {/* Metric 1 */}
        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Assigned to Me
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {myWorkIssues.length}
            </span>
            <span className="text-xs text-muted-foreground">active items</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {currentCycle?.name || 'Active Sprint'}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{cycleCompletionRate}%</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {doneCount}
            </span>
            <span className="text-xs text-muted-foreground font-mono">/ {issues.length} issues</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Attention Required
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span
              className={`text-xl font-bold font-mono tracking-tight ${
                urgentOrBlockedIssues.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}
            >
              {urgentOrBlockedIssues.length}
            </span>
            <span className="text-xs text-muted-foreground">urgent or blocked</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Active Projects
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {projects.length}
            </span>
            <span className="text-xs text-muted-foreground">delivery tracks</span>
          </div>
        </div>
      </div>

      {/* Main Split Grid: Left Primary Queue & Chart + Right Context & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Primary Section: My Assigned Issues Queue */}
          <div className="border border-border/80 rounded-lg bg-card overflow-hidden">
            <div className="p-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">My Work Queue</span>
                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                  {myWorkIssues.length}
                </span>
              </div>
              <Button variant="ghost" size="sm" asChild className="h-6 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground">
                <Link to="/my-issues">
                  <span>View full list</span>
                  <ChevronRight className="size-3" />
                </Link>
              </Button>
            </div>

            <div className="divide-y divide-border/60">
              {myWorkIssues.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">All caught up</p>
                  <p className="text-xs mt-0.5">No active tasks currently assigned to you.</p>
                </div>
              ) : (
                myWorkIssues.slice(0, 6).map((issue) => (
                  <div
                    key={issue.id}
                    onClick={() => handleOpenIssue(issue)}
                    className="flex items-center justify-between p-3 hover:bg-muted/40 cursor-pointer transition-colors text-xs select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <span className={`size-2 rounded-full shrink-0 ${getStatusDot(issue.status)}`} />
                      <span className="font-mono text-xs font-semibold text-muted-foreground shrink-0">
                        {issue.identifier}
                      </span>
                      <span className="text-foreground truncate font-medium">
                        {issue.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <PriorityIcon priority={issue.priority} />
                      <span className="font-mono text-xs text-muted-foreground capitalize hidden sm:inline">
                        {issue.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Single High-Craft Engineering Velocity Chart */}
          <div className="border border-border/80 rounded-lg bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Sprint Velocity & Burnup
                </span>
                <span className="text-xs text-muted-foreground">
                  Throughput progression compared against sprint scope.
                </span>
              </div>

              {/* Time range pills */}
              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-[5px] border border-border/80">
                <button
                  type="button"
                  onClick={() => setVelocityRange('7d')}
                  className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                    velocityRange === '7d'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  7D
                </button>
                <button
                  type="button"
                  onClick={() => setVelocityRange('14d')}
                  className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                    velocityRange === '14d'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  14D
                </button>
                <button
                  type="button"
                  onClick={() => setVelocityRange('cycle')}
                  className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                    velocityRange === 'cycle'
                      ? 'bg-background text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cycle
                </button>
              </div>
            </div>

            <div className="h-56 w-full">
              <Line data={velocityData} options={velocityOptions} />
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Cycle Overview Card */}
          <div className="border border-border/80 rounded-lg bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">
                {currentCycle?.name || 'Sprint 12'}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {cycleCompletionRate}%
              </span>
            </div>

            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${cycleCompletionRate}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground border-t border-border/60 pt-2.5">
              <span>{doneCount} completed</span>
              <span>{issues.length - doneCount} remaining</span>
            </div>
          </div>

          {/* Recent Activity Audit Trail (Linear-style) */}
          <div className="border border-border/80 rounded-lg bg-card overflow-hidden">
            <div className="p-3 border-b border-border/70 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Live Activity</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">Workspace</span>
            </div>

            <div className="divide-y divide-border/60 text-xs">
              {activities.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No recent activities recorded.
                </div>
              ) : (
                activities.slice(0, 5).map((act) => {
                  const createdAt = new Date(act.createdAt);
                  const timeAgo = !isNaN(createdAt.getTime())
                    ? formatDistanceToNow(createdAt, { addSuffix: true })
                    : '';

                  return (
                    <div key={act.id} className="p-2.5 flex items-start gap-2 hover:bg-muted/30 transition-colors">
                      <span className="size-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-foreground truncate text-xs">
                            {act.actorName || 'Team Member'}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {timeAgo}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {act.type.replace('issue.', '').replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Initiatives / Project Status */}
          <div className="border border-border/80 rounded-lg bg-card overflow-hidden">
            <div className="p-3 border-b border-border/70 flex items-center justify-between bg-muted/20">
              <span className="text-xs font-semibold text-foreground">Initiatives</span>
              <Button variant="ghost" size="sm" asChild className="h-5 text-xs px-1 text-muted-foreground">
                <Link to="/projects">All</Link>
              </Button>
            </div>

            <div className="divide-y divide-border/60 text-xs">
              {projects.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No projects active.
                </div>
              ) : (
                projects.slice(0, 4).map((proj) => {
                  const healthDot =
                    proj.health === 'off_track'
                      ? 'bg-rose-500'
                      : proj.health === 'at_risk'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';

                  return (
                    <div key={proj.id} className="p-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className={`size-1.5 rounded-full shrink-0 ${healthDot}`} />
                        <Link
                          to={`/projects/${proj.id}`}
                          className="font-medium text-foreground truncate hover:underline text-xs"
                        >
                          {proj.name}
                        </Link>
                      </div>

                      <Badge variant="outline" className="text-xs font-mono capitalize px-1 py-0 h-4">
                        {proj.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Issue Dialog */}
      <CreateIssueDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Integrated Issue Detail Sheet */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
