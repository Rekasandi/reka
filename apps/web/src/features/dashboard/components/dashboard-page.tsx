import * as React from 'react';
import { Badge, Button, Card, Skeleton } from '@reka/ui';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  Inbox as InboxIcon,
  ChevronRight,
  Activity,
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
import { PriorityIcon } from '../../issues/components/priority-picker';
import { STATUS_CONFIG } from '../../issues/components/status-picker';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { isIssueClosed, type Issue } from '@reka/types';
import { attentionReasons } from '../lib/dashboard-work';
import { DashboardActionSections } from './dashboard-action-sections';

// Register only the chart elements used on this page.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
);

export function DashboardPage() {
  const { user } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  // Queries
  const { data: issues = [], isLoading: issuesLoading, isError: issuesError, refetch: retryIssues } = useIssues();
  const { data: projects = [], isLoading: projectsLoading, isError: projectsError } = useProjects();
  const { data: cycles = [], isLoading: cyclesLoading, isError: cyclesError } = useCycles();
  const { data: unreadData } = useUnreadCount();
  const { data: activities = [], isLoading: activitiesLoading } = useWorkspaceActivities(8);

  const handleOpenIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDetailOpen(true);
  };

  // Metrics
  const myWorkIssues = React.useMemo(() => {
    if (!user) return [];
    return issues.filter(
      (issue) => issue.assigneeId === user.id && !isIssueClosed(issue),
    );
  }, [issues, user]);

  const attentionIssues = issues.filter((issue) => attentionReasons(issue).length > 0);
  const activeCycles = cycles.filter((cycle) => cycle.status === 'active');

  // Chart styling colors based on Geist tokens
  const textColor = isDark ? '#a1a1a1' : '#666666';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
  const tooltipBg = isDark ? '#171717' : '#ffffff';
  const tooltipText = isDark ? '#ffffff' : '#171717';
  const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : '#ebebeb';

  const issuesByStatus = React.useMemo(() => {
    const statuses = [...new Set(issues.map((issue) => issue.status))]
      .sort((a, b) => (STATUS_CONFIG[a]?.number ?? 100) - (STATUS_CONFIG[b]?.number ?? 100));

    return {
      labels: statuses.map((status) => STATUS_CONFIG[status]?.label ?? status.replaceAll('_', ' ')),
      datasets: [{
        label: 'Issues',
        data: statuses.map((status) => issues.filter((issue) => issue.status === status).length),
        backgroundColor: isDark ? '#ededed' : '#171717',
        borderRadius: 4,
        maxBarThickness: 28,
      }],
    };
  }, [issues, isDark]);

  const issueStatusOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 8,
        cornerRadius: 4,
        bodyFont: { family: 'Geist Variable, sans-serif', size: 12 },
        titleFont: { family: 'Geist Variable, sans-serif', size: 12, weight: 600 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, precision: 0, font: { family: 'Geist Variable, sans-serif', size: 12 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor, font: { family: 'Geist Variable, sans-serif', size: 12 }, precision: 0, stepSize: 1 },
      },
    },
  };

  return (
    <div className="flex flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Top Workspace Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Dashboard
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your work, upcoming deadlines, and team delivery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            asChild
          >
            <Link to="/inbox">
              <InboxIcon />
              <span>Inbox</span>
              {unreadData && unreadData.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-mono">
                  {unreadData.count}
                </span>
              )}
            </Link>
          </Button>

          <Button
            className="px-3"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus />
            <span>New Issue</span>
            <kbd className="hidden sm:inline font-mono text-xs opacity-60 ml-0.5">C</kbd>
          </Button>
        </div>
      </div>

      {/* Clean Hairline Metric Strip */}
      <div className="grid grid-cols-2 gap-4 border-b border-border pb-5 md:grid-cols-4">
        {/* Metric 1 */}
        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Assigned to Me
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {issuesLoading ? '…' : issuesError ? '-' : myWorkIssues.length}
            </span>
            <span className="text-xs text-muted-foreground">active items</span>
          </div>
        </div>

        {/* Active cycles across teams */}
        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">Active cycles</span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold tabular-nums tracking-tight text-foreground">{cyclesLoading ? '…' : cyclesError ? '-' : activeCycles.length}</span>
            <span className="text-xs text-muted-foreground">across teams</span>
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
                attentionIssues.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              }`}
            >
              {issuesLoading ? '…' : issuesError ? '-' : attentionIssues.length}
            </span>
            <span className="text-xs text-muted-foreground">issues to triage</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Projects
          </span>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-xl font-bold font-mono tracking-tight text-foreground">
              {projectsLoading ? '…' : projectsError ? '-' : projects.length}
            </span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
        </div>
      </div>

      <DashboardActionSections onSelectIssue={handleOpenIssue} />

      {/* Main Split Grid: Left Primary Queue & Chart + Right Context & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Assigned issues */}
          <Card className="min-w-0 gap-0 py-0">
            <div className="p-3.5 border-b border-border/70 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">My assigned issues</span>
                <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                  {myWorkIssues.length}
                </span>
              </div>
              <Button variant="ghost" size="xs" asChild className="gap-1 px-2 text-muted-foreground hover:text-foreground">
                <Link to="/my-issues">
                  <span>View full list</span>
                  <ChevronRight className="size-3" />
                </Link>
              </Button>
            </div>

            <div className="divide-y divide-border/60">
              {issuesLoading ? <Skeleton className="h-28 w-full" /> : issuesError ? <div role="alert" className="flex items-center gap-3 py-6"><p className="text-sm text-muted-foreground">Could not load issues.</p><Button variant="outline" size="sm" onClick={() => retryIssues()}>Retry</Button></div> : myWorkIssues.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">All caught up</p>
                  <p className="text-xs mt-0.5">No active tasks currently assigned to you.</p>
                </div>
              ) : (
                myWorkIssues.slice(0, 6).map((issue) => (
                  <button
                    type="button"
                    key={issue.id}
                    onClick={() => handleOpenIssue(issue)}
                    className="flex w-full items-center justify-between rounded-md p-3 text-left text-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <span className="shrink-0">{STATUS_CONFIG[issue.status]?.renderIcon()}</span>
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
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Status distribution from real issues */}
          <Card className="min-w-0 gap-0 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Issues by status
                </span>
                <span className="text-xs text-muted-foreground">
                  Current distribution across the workspace.
                </span>
              </div>

            </div>

            <div className="h-56 w-full">
              {issuesLoading ? <Skeleton className="h-full w-full" /> : issues.length ? <Bar data={issuesByStatus} options={issueStatusOptions} /> : <p className="py-8 text-sm text-muted-foreground">{issuesError ? 'Issue distribution is unavailable.' : 'No issues to show yet.'}</p>}
            </div>
          </Card>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Recent activity */}
          <Card className="gap-0 py-0">
            <div className="p-3 border-b border-border/70 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">Recent activity</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">Workspace</span>
            </div>

            <div className="divide-y divide-border/60 text-xs">
              {activitiesLoading ? <Skeleton className="h-24 w-full" /> : activities.length === 0 ? (
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
          </Card>

          {/* Projects */}
          <Card className="gap-0 py-0">
            <div className="p-3 border-b border-border/70 flex items-center justify-between bg-muted/20">
              <span className="text-xs font-semibold text-foreground">Projects</span>
              <Button variant="ghost" size="xs" asChild className="px-1 text-muted-foreground">
                <Link to="/projects">All</Link>
              </Button>
            </div>

            <div className="divide-y divide-border/60 text-xs">
              {projectsLoading ? <Skeleton className="h-24 w-full" /> : projects.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No projects active.
                </div>
              ) : (
                projects.slice(0, 4).map((proj) => {
                  return (
                    <div key={proj.id} className="p-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span title={proj.health.replaceAll('_', ' ')} className="shrink-0 text-muted-foreground">{proj.health === 'on_track' ? <CheckCircle2 className="size-3.5" /> : <AlertCircle className="size-3.5" />}</span>
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
          </Card>
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
