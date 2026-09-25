import * as React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Skeleton,
} from '@reka/ui';
import {
  ArrowLeft,
  Plus,
  Repeat,
  Calendar,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Clock,
  Check,
} from 'lucide-react';
import { useCycle, useUpdateCycle, useDeleteCycle } from '../hooks/use-cycles';
import { useIssues } from '../../issues/hooks/use-issues';
import { IssueListView } from '../../issues/components/issue-list-view';
import { CreateIssueDialog } from '../../issues/components/create-issue-dialog';
import { IssueDetailSheet } from '../../issues/components/issue-detail-sheet';
import { CompleteCycleDialog } from './complete-cycle-dialog';
import { BurndownChart } from './burndown-chart';
import type { Issue } from '@reka/types';
import type { Cycle } from '../api/cycles.api';

function CycleStatusBadge({ status }: { status: Cycle['status'] }) {
  if (status === 'active') {
    return (
      <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-500 text-[10px] font-normal gap-1 h-5">
        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>Active</span>
      </Badge>
    );
  }
  if (status === 'completed') {
    return (
      <Badge variant="outline" className="border-border/60 bg-muted/40 text-muted-foreground text-[10px] font-normal gap-1 h-5">
        <Check className="size-3" />
        <span>Completed</span>
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] font-normal gap-1 h-5">
      <Clock className="size-3 text-muted-foreground" />
      <span>Upcoming</span>
    </Badge>
  );
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sStr = s.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const eStr = e.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${sStr} — ${eStr}`;
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
  const { data: allIssues = [] } = useIssues();
  const deleteMutation = useDeleteCycle();

  // Filter issues belonging to this cycle
  const cycleIssues = React.useMemo(() => {
    return allIssues.filter((i) => i.cycleId === id);
  }, [allIssues, id]);

  const filteredIssues = React.useMemo(() => {
    if (issueFilterTab === 'active') {
      return cycleIssues.filter((i) => i.status === 'todo' || i.status === 'in_progress' || i.status === 'in_review');
    }
    if (issueFilterTab === 'done') {
      return cycleIssues.filter((i) => i.status === 'done' || i.status === 'canceled');
    }
    return cycleIssues;
  }, [cycleIssues, issueFilterTab]);

  const completedCount = cycleIssues.filter((i) => i.status === 'done').length;
  const progressPercent = cycleIssues.length > 0 ? Math.round((completedCount / cycleIssues.length) * 100) : 0;

  const handleDelete = () => {
    if (!cycle) return;
    if (confirm(`Delete ${cycle.name || `Cycle ${cycle.number}`}?`)) {
      deleteMutation.mutate(cycle.id, {
        onSuccess: () => navigate('/cycles'),
      });
    }
  };

  const handleOpenIssueDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsIssueDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-40 rounded-[6px]" />
        <Skeleton className="h-32 w-full rounded-[12px]" />
        <Skeleton className="h-64 w-full rounded-[12px]" />
      </div>
    );
  }

  if (isError || !cycle) {
    return (
      <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-6 text-xs text-destructive flex items-center justify-between max-w-3xl mx-auto">
        <span>Failed to load cycle details.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
          <RefreshCw data-icon="inline-start" className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto selection:bg-foreground selection:text-background">
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
          {!cycle.isCompleted && (
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
      <div className="rounded-[14px] border border-border/80 bg-card/40 p-6 flex flex-col gap-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-[8px] bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/70">
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

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
            <span>{completedCount} of {cycleIssues.length} issues completed</span>
            <span className="font-semibold text-foreground">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Burndown Chart Component */}
      <BurndownChart
        startDate={cycle.startDate}
        endDate={cycle.endDate}
        totalIssues={cycleIssues.length}
        completedIssues={completedCount}
      />

      {/* Issues in Cycle Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-[-0.02em] text-foreground">Cycle Issues</h2>
            <span className="font-mono text-[11px] text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {cycleIssues.length}
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => setIsCreateIssueOpen(true)}
            className="rounded-[6px] h-7 px-2.5 text-xs font-medium"
          >
            <Plus data-icon="inline-start" className="size-3" />
            <span>Add Issue to Cycle</span>
          </Button>
        </div>

        {/* Filter sub-tabs */}
        <div className="flex items-center gap-1 border-b border-border/60 pb-2">
          {[
            { id: 'all', label: 'All', count: cycleIssues.length },
            { id: 'active', label: 'Active', count: cycleIssues.filter((i) => i.status !== 'done' && i.status !== 'canceled').length },
            { id: 'done', label: 'Done', count: completedCount },
          ].map((tab) => {
            const isSelected = issueFilterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setIssueFilterTab(tab.id)}
                className={`h-6 px-2 text-xs rounded-[5px] font-medium transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-secondary text-foreground shadow-2xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* Issue List View */}
        <IssueListView
          issues={filteredIssues}
          onSelectIssue={handleOpenIssueDetail}
        />
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
      />

      {/* Detail Sheet for issues */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={isIssueDetailOpen}
        onOpenChange={setIsIssueDetailOpen}
      />
    </div>
  );
}
