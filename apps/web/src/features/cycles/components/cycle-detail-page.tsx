import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Button,
  Skeleton,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@reka/ui';
import {
  ArrowLeft,
  Plus,
  Repeat,
  Calendar,
  CheckCircle2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useCycle, useCycleHistory, useDeleteCycle, useReopenCycle } from '../hooks/use-cycles';
import { useIssues, useUpdateIssue } from '../../issues/hooks/use-issues';
import { IssueListView } from '../../issues/components/issue-list-view';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { CompleteCycleDialog } from './complete-cycle-dialog';
import { BurndownChart } from './burndown-chart';
import { CycleStatusBadge } from './cycle-status-badge';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { getIssueStatusCategory, isIssueClosed, type Issue } from '@reka/types';

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sStr = s.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const eStr = e.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${sStr} - ${eStr}`;
}

export function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isCreateIssueOpen, setIsCreateIssueOpen] = React.useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isIssueDetailOpen, setIsIssueDetailOpen] = React.useState(false);
  const [issueFilterTab, setIssueFilterTab] = React.useState('all');

  const { data: cycle, isLoading, isError, refetch } = useCycle(id);
  const { data: history, isLoading: historyLoading, isError: historyError, refetch: refetchHistory } = useCycleHistory(id);
  const { data: allIssues = [] } = useIssues();
  const updateIssueMutation = useUpdateIssue();
  const deleteMutation = useDeleteCycle();
  const reopenMutation = useReopenCycle();

  // Filter issues belonging to this cycle
  const cycleIssues = React.useMemo(() => {
    return allIssues.filter((i) => i.cycleId === id);
  }, [allIssues, id]);

  const backlogIssues = React.useMemo(
    () => allIssues.filter((issue) =>
      issue.teamId === cycle?.teamId &&
      !issue.cycleId &&
      !isIssueClosed(issue),
    ),
    [allIssues, cycle?.teamId],
  );

  const filteredIssues = React.useMemo(() => {
    if (issueFilterTab === 'active') {
      return cycleIssues.filter((issue) => ['unstarted', 'started'].includes(getIssueStatusCategory(issue)));
    }
    if (issueFilterTab === 'done') {
      return cycleIssues.filter((issue) => ['completed', 'canceled'].includes(getIssueStatusCategory(issue)));
    }
    return cycleIssues;
  }, [cycleIssues, issueFilterTab]);

  const completedCount = cycle?.completedIssues ?? cycleIssues.filter((issue) => getIssueStatusCategory(issue) === 'completed').length;
  const progressPercent = cycle?.progress ?? (cycle?.totalIssues ? Math.round(completedCount / cycle.totalIssues * 100) : 0);
  const remainingCount = cycle?.remainingIssues ?? Math.max((cycle?.totalIssues ?? cycleIssues.length) - completedCount, 0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const handleDelete = () => {
    if (!cycle) return;
    setIsDeleteDialogOpen(true);
  };

  const handleOpenIssueDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsIssueDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-none mx-auto">
        <Skeleton className="h-8 w-40 rounded-[6px]" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !cycle) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-xs text-destructive flex items-center justify-between max-w-3xl mx-auto">
        <span>Failed to load cycle details.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
          <RefreshCw data-icon="inline-start" className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/cycles"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Cycles</span>
        </Link>

        <div className="flex items-center gap-2">
          {cycle.isCompleted ? <Button variant="outline" size="sm" disabled={reopenMutation.isPending} onClick={() => reopenMutation.mutate(cycle.id)} className="h-8 text-xs rounded-[6px]">Reopen cycle</Button> : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompleteOpen(true)}
              className="h-8 text-xs rounded-[6px]"
            >
              <CheckCircle2 data-icon="inline-start" className="size-3.5 text-emerald-500" />
              <span>Complete Cycle...</span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleDelete}
            className="text-muted-foreground/50 hover:text-destructive"
            title="Delete cycle"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Cycle Header Spotlight */}
      <div className="flex flex-col gap-5 border-b border-border pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/70">
              <Repeat className="size-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {cycle.name || `Cycle ${cycle.number}`}
                </h1>
                <CycleStatusBadge status={cycle.status} />
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground mt-0.5">
                <Calendar className="size-3 text-muted-foreground/70" />
                <span>{formatDateRange(cycle.startDate, cycle.endDate)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Goals / Description */}
        {cycle.description && (
          <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl">
            {cycle.description}
          </p>
        )}

      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
      {/* Burndown Chart Component */}
      <BurndownChart snapshots={history?.snapshots ?? []} isLoading={historyLoading} isError={historyError} onRetry={() => void refetchHistory()} />

      {/* Issues in Cycle Section */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">Cycle Issues</h2>
            <span className="font-mono text-xs text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {cycleIssues.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              onValueChange={(issueId) => updateIssueMutation.mutate({
                id: issueId,
                data: { cycleId: cycle.id },
              })}
            >
              <SelectTrigger aria-label="Plan backlog issue" size="compact" disabled={!backlogIssues.length} className="w-52">
                <SelectValue placeholder={backlogIssues.length ? 'Plan backlog issue…' : 'No backlog issues'} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {backlogIssues.map((issue) => (
                    <SelectItem key={issue.id} value={issue.id}>
                      {issue.identifier} · {issue.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => setIsCreateIssueOpen(true)}
              className="rounded-[6px] h-7 px-2.5 text-xs font-medium"
            >
              <Plus data-icon="inline-start" className="size-3" />
              <span>New Issue</span>
            </Button>
          </div>
        </div>

        {/* Filter sub-tabs */}
        <div className="flex items-center gap-1 border-b border-border/60 pb-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'active', label: 'Active' },
            { id: 'done', label: 'Done' },
          ].map((tab) => {
            const isSelected = issueFilterTab === tab.id;
            return (
              <Button key={tab.id} variant="category" size="sm" aria-pressed={isSelected} onClick={() => setIssueFilterTab(tab.id)}>{tab.label}</Button>
            );
          })}
        </div>

        {/* Issue List View */}
        <IssueListView
          issues={filteredIssues}
          onSelectIssue={handleOpenIssueDetail}
        />
      </div>
        </div>

        <aside className="h-fit rounded-lg border border-border/80 bg-card p-4 lg:sticky lg:top-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Cycle summary</span>
            <CycleStatusBadge status={cycle.status} />
          </div>
          <div className="mt-4 border-y border-border/60 py-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="font-mono text-sm font-semibold text-foreground">{progressPercent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${progressPercent}%` }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-muted-foreground">Completed</p><p className="mt-0.5 font-mono text-foreground">{completedCount}</p></div>
              <div><p className="text-muted-foreground">Remaining</p><p className="mt-0.5 font-mono text-foreground">{remainingCount}</p></div>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">Schedule</p>
            <p className="mt-1 font-mono text-xs text-foreground">{formatDateRange(cycle.startDate, cycle.endDate)}</p>
          </div>
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="text-xs font-semibold text-foreground">Capacity & estimates</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
              <div><p className="text-muted-foreground">Planned</p><p className="mt-0.5 font-mono text-foreground">{cycle.plannedEstimate ?? 0} pts</p></div>
              <div><p className="text-muted-foreground">Capacity</p><p className="mt-0.5 font-mono text-foreground">{cycle.capacity === null || cycle.capacity === undefined ? 'Not set' : `${cycle.capacity} pts`}</p></div>
              <div><p className="text-muted-foreground">Completed</p><p className="mt-0.5 font-mono text-foreground">{cycle.completedEstimate ?? 0} pts</p></div>
              <div><p className="text-muted-foreground">Remaining estimate</p><p className="mt-0.5 font-mono text-foreground">{cycle.remainingEstimate ?? 0} pts</p></div>
            </div>
            {cycle.capacity !== null && cycle.capacity !== undefined && <p className="mt-2 text-xs text-muted-foreground">{cycle.remainingCapacity! < 0 ? `${Math.abs(cycle.remainingCapacity!)} pts over capacity` : `${cycle.remainingCapacity} pts capacity remaining`}</p>}
            {!!cycle.missingEstimateCount && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{cycle.missingEstimateCount} planned issue{cycle.missingEstimateCount === 1 ? '' : 's'} missing an estimate.</p>}
          </div>
        </aside>
      </div>

      {/* Complete Cycle Modal */}
      <CompleteCycleDialog
        cycle={cycle}
        open={isCompleteOpen}
        onOpenChange={setIsCompleteOpen}
      />

      {/* Dialog for creating issue pre-assigned to this cycle */}
      <CreateIssueDialog
        open={isCreateIssueOpen}
        onOpenChange={setIsCreateIssueOpen}
        defaultCycleId={cycle.id}
        defaultTeamId={cycle.teamId}
      />

      {/* Detail Sheet for issues */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={isIssueDetailOpen}
        onOpenChange={setIsIssueDetailOpen}
      />

      {/* Delete Confirmation Alert Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={`Delete ${cycle ? (cycle.name || `Cycle ${cycle.number}`) : 'cycle'}?`}
        description="This will permanently delete this cycle and unassign all scheduled issues."
        onConfirm={() => {
          if (cycle) {
            deleteMutation.mutate(cycle.id, {
              onSuccess: () => navigate('/cycles'),
            });
          }
        }}
      />
    </div>
  );
}
