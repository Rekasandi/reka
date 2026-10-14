import * as React from 'react';
import { useQueries } from '@tanstack/react-query';
import { getIssueStatusCategory, type Issue } from '@reka/types';
import {
  Checkbox,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
} from '@reka/ui';
import { useUpdateIssue, useDeleteIssue, useArchiveIssue, useMoveIssueToTop, useBulkUpdateIssues } from '../hooks/use-issues';
import {
  Trash2,
  ChevronRight,
  CornerDownRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight,
  X,
} from 'lucide-react';
import { StatusPicker, STATUS_CONFIG } from './status-picker';
import { IssueRowProperties } from './issue-row-properties';
import { IssueContextMenu } from './issue-context-menu';
import { CreateIssueDialog } from './create-issue-dialog';
import { PriorityIcon, PriorityPicker, PRIORITY_CONFIG } from './priority-picker';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { getTeamWorkflowStates } from '../../teams/api/teams.api';

interface IssueListViewProps {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
  focusedIndex?: number;
  onFocusIndex?: (index: number) => void;
  showSubtasks?: boolean;
}

export function IssueListView({
  issues,
  onSelectIssue,
  focusedIndex = -1,
  onFocusIndex,
  showSubtasks = true,
}: IssueListViewProps) {
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const archiveMutation = useArchiveIssue();
  const moveMutation = useMoveIssueToTop();
  const bulkMutation = useBulkUpdateIssues();
  const [expandedIssues, setExpandedIssues] = React.useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = React.useState(false);
  const [subIssueParent, setSubIssueParent] = React.useState<Issue | null>(null);
  const selectedTeamIds = React.useMemo(() => [...new Set(issues.filter((issue) => selectedIds.has(issue.id)).map((issue) => issue.teamId))], [issues, selectedIds]);
  const workflowQueries = useQueries({ queries: selectedTeamIds.map((teamId) => ({
    queryKey: ['team-workflow-states', teamId], queryFn: () => getTeamWorkflowStates(teamId), enabled: !!teamId,
  })) });
  const workflowReady = selectedTeamIds.length > 0 && workflowQueries.every((query) => query.isSuccess);
  const workflows = workflowQueries.map((query) => query.data ?? []);
  const bulkStatusOptions = workflows[0]?.filter((state) => state.isActive && workflows.slice(1).every((states) => states.some((candidate) => candidate.key === state.key && candidate.isActive))) ?? [];

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIssues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group into root issues and subtasks
  const { rootIssues, subtasksByParent } = React.useMemo(() => {
    const roots: Issue[] = [];
    const subtaskMap: Record<string, Issue[]> = {};

    for (const issue of issues) {
      if (issue.parentId) {
        if (!subtaskMap[issue.parentId]) {
          subtaskMap[issue.parentId] = [];
        }
        subtaskMap[issue.parentId].push(issue);
      } else {
        roots.push(issue);
      }
    }

    return { rootIssues: roots, subtasksByParent: subtaskMap };
  }, [issues]);

  const handleBatchStatus = (status: string) => {
    bulkMutation.mutate({ ids: [...selectedIds], status }, { onSuccess: () => setSelectedIds(new Set()) });
  };

  const handleBatchPriority = (priority: string) => {
    bulkMutation.mutate({ ids: [...selectedIds], priority }, { onSuccess: () => setSelectedIds(new Set()) });
  }

  const handleBatchDelete = () => {
    setIsBatchDeleteOpen(true);
  };

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 p-14 text-center text-xs text-muted-foreground bg-card/10">
        No issues found. Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">C</kbd> anywhere to create.
      </div>
    );
  }

  return (
    <div className="issue-work-surface relative">
      <div className="flex flex-col gap-px select-none">
        {rootIssues.map((issue, idx) => {
          const subtasks = showSubtasks ? (subtasksByParent[issue.id] || []) : [];
          const hasSubtasks = subtasks.length > 0;
          const isExpanded = !!expandedIssues[issue.id];
          const isFocused = focusedIndex === idx;
          const isChecked = selectedIds.has(issue.id);
          const doneSubtasksCount = subtasks.filter((subtask) => getIssueStatusCategory(subtask) === 'completed').length;

          return (
            <React.Fragment key={issue.id}>
              {/* Parent Row */}
              <IssueContextMenu issue={issue} onOpen={onSelectIssue ? () => onSelectIssue(issue) : undefined}
                onAddSubIssue={() => setSubIssueParent(issue)} onUpdate={data => updateMutation.mutate({ id: issue.id, data })} onDelete={() => setDeleteTargetId(issue.id)} onArchive={() => archiveMutation.mutate({ id: issue.id, restore: !!issue.archivedAt })} onMoveToTop={() => moveMutation.mutate(issue.id)}>
              <div
                data-testid={`issue-row-${issue.id}`}
                onClick={() => {
                  onFocusIndex?.(idx);
                  onSelectIssue?.(issue);
                }}
                className={`issue-work-row flex items-center justify-between rounded-[6px] px-3.5 py-2.5 transition-colors text-xs gap-3 cursor-pointer group relative ${
                  isFocused
                    ? 'bg-secondary/70'
                    : isChecked
                    ? 'bg-secondary/40'
                    : 'hover:bg-secondary/30'
                }`}
              >
                {/* Visual J/K indicator strip */}
                {isFocused && (
                  <div className="absolute left-0 inset-y-0 w-0.5 bg-primary" />
                )}

                {/* Left section: Checkbox, Expand Toggle, Priority, ID, Status, Title */}
                <div className="issue-row-main flex items-center gap-2.5 min-w-0 flex-1">
                  <Checkbox
                    aria-label={`Select issue ${issue.identifier}`}
                    checked={isChecked}
                    onClick={(e) => handleToggleSelect(issue.id, e)}
                    className="cursor-pointer shrink-0 rounded-[4px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 [@media(hover:none)]:opacity-100"
                  />

                  {/* Subtask expand chevron */}
                  {hasSubtasks ? (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(issue.id, e)}
                      className="size-5 rounded-[4px] flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-secondary transition-all"
                      title={isExpanded ? 'Collapse sub-tasks' : 'Expand sub-tasks'}
                    >
                      <ChevronRight className={`size-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  ) : (
                    <div className="size-5 shrink-0" aria-hidden="true" />
                  )}

                  <PriorityPicker
                    priority={issue.priority}
                    onPriorityChange={(newPriority) => updateMutation.mutate({ id: issue.id, data: { priority: newPriority as any } })}
                  />

                  <span className="font-mono text-xs text-muted-foreground font-semibold shrink-0 group-hover:text-foreground/80 transition-colors">
                    {issue.identifier}
                  </span>

                  {/* Status Picker: Quick compact icon */}
                  <StatusPicker
                    teamId={issue.teamId}
                    status={issue.status}
                    appearance="badge"
                    onStatusChange={(newStatus) => updateMutation.mutate({ id: issue.id, data: { status: newStatus as any } })}
                  />

                  <button type="button" className="issue-row-title truncate rounded-sm text-left font-medium tracking-tight text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open issue ${issue.identifier}: ${issue.title}`} title={issue.title}>
                    {issue.title}
                  </button>

                  {/* GitHub Issue Linked Badge */}
                  {issue.githubIssueNumber && (
                    <span className="font-mono text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded shrink-0">
                      GH #{issue.githubIssueNumber}
                    </span>
                  )}

                  {/* Subtask Count Tag on Parent */}
                  {hasSubtasks && (
                    <span
                      onClick={(e) => toggleExpand(issue.id, e)}
                      className="ml-1 text-xs font-mono text-muted-foreground/80 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.2 rounded-[4px] shrink-0"
                      title={`${doneSubtasksCount} of ${subtasks.length} sub-tasks completed`}
                    >
                      {doneSubtasksCount}/{subtasks.length}
                    </span>
                  )}
                </div>

                {/* Right section: Assignee, Type, Delete action */}
                <div className="issue-row-meta flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <IssueRowProperties
                    issue={issue}
                    onUpdate={(data) => updateMutation.mutate({ id: issue.id, data })}
                  />

                  <button
                    type="button"
                    onClick={(e) => handleDelete(issue.id, e)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 rounded-[4px] hover:bg-destructive/10"
                    title="Delete issue"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              </IssueContextMenu>

              {/* Sub-tasks Nested Sub-list */}
              {hasSubtasks && isExpanded && (
                <div className="ml-3.5 border-l border-border/50 bg-secondary/15 divide-y divide-border/30">
                  {subtasks.map((st) => {
                    const isDone = getIssueStatusCategory(st) === 'completed';
                    return (
                      <IssueContextMenu key={st.id} issue={st} onOpen={onSelectIssue ? () => onSelectIssue(st) : undefined}
                        onAddSubIssue={() => setSubIssueParent(st)} onUpdate={data => updateMutation.mutate({ id: st.id, data })} onDelete={() => setDeleteTargetId(st.id)} onArchive={() => archiveMutation.mutate({ id: st.id, restore: !!st.archivedAt })} onMoveToTop={() => moveMutation.mutate(st.id)}>
                      <div
                        onClick={() => onSelectIssue?.(st)}
                        className="issue-work-row flex items-center justify-between pl-8 pr-3.5 py-2 hover:bg-secondary/40 transition-colors text-xs gap-3 cursor-pointer group/sub"
                      >
                        <div className="issue-row-main flex items-center gap-2 min-w-0 flex-1">
                          <CornerDownRight className="size-3 text-muted-foreground/40 shrink-0" />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateMutation.mutate({
                                id: st.id,
                                data: { status: (isDone ? 'todo' : 'done') as any },
                              });
                            }}
                            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            title={isDone ? 'Mark as todo' : 'Mark as done'}
                          >
                            <CheckCircle2
                              className={`size-3.5 transition-colors ${
                                isDone ? 'text-primary fill-primary/20' : 'text-muted-foreground/40 hover:text-muted-foreground'
                              }`}
                            />
                          </button>

                          <PriorityPicker
                            priority={st.priority}
                            onPriorityChange={(newPriority) => updateMutation.mutate({ id: st.id, data: { priority: newPriority as any } })}
                          />

                          <span className="font-mono text-xs text-muted-foreground/70 font-semibold shrink-0">
                            {st.identifier}
                          </span>

                          <StatusPicker
                            teamId={st.teamId}
                            status={st.status}
                            appearance="badge"
                            onStatusChange={(newStatus) => updateMutation.mutate({ id: st.id, data: { status: newStatus as any } })}
                          />

                          <button type="button" className={`issue-row-title truncate rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isDone ? 'line-through text-muted-foreground/70' : 'text-foreground/90'}`} aria-label={`Open issue ${st.identifier}: ${st.title}`} title={st.title}>
                            {st.title}
                          </button>
                        </div>

                        <div className="issue-row-meta flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <IssueRowProperties
                            issue={st}
                            onUpdate={(data) => updateMutation.mutate({ id: st.id, data })}
                          />
                          <button
                            type="button"
                            onClick={(e) => handleDelete(st.id, e)}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover/sub:opacity-100 focus-visible:opacity-100 transition-opacity p-1 rounded-[4px] hover:bg-destructive/10"
                            title="Delete sub-task"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                      </IssueContextMenu>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Linear Batch Actions Floating Bar */}
      {selectedIds.size > 0 && (
        <div role="toolbar" aria-label="Selected issue actions"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 sm:gap-3 bg-popover/95 backdrop-blur-md border border-border px-4 py-2 rounded-lg shadow-2xl text-xs select-none animate-in fade-in-0 slide-in-from-bottom-4">
          <div className="flex items-center gap-2 font-mono font-medium text-foreground">
            <span className="size-5 rounded-[4px] bg-primary text-primary-foreground flex items-center justify-center text-xs">
              {selectedIds.size}
            </span>
            <span>selected</span>
          </div>

          <div className="h-4 w-px bg-border/80" />

          {/* Batch Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={bulkMutation.isPending || !workflowReady || bulkStatusOptions.length === 0}>
                Status...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-40 p-1">
              {bulkStatusOptions.map((state) => (
                <DropdownMenuItem key={state.key} onClick={() => handleBatchStatus(state.key)} className="text-xs gap-2">
                  {STATUS_CONFIG[state.key]?.renderIcon() ?? <span className="size-3 rounded-full border border-current" style={{ color: state.color, backgroundColor: `${state.color}30` }} />}
                  <span>{state.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Batch Priority Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={bulkMutation.isPending}>
                Priority...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-36 p-1">
              {PRIORITY_CONFIG.map((item) => (
                <DropdownMenuItem key={item.key} onClick={() => handleBatchPriority(item.key)} className="text-xs gap-2">
                  <PriorityIcon priority={item.key} />
                  <span>{item.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="xs"
            onClick={handleBatchDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
            <span>Delete</span>
          </Button>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <CreateIssueDialog
        open={!!subIssueParent}
        onOpenChange={open => !open && setSubIssueParent(null)}
        defaultTeamId={subIssueParent?.teamId}
        defaultParentId={subIssueParent?.id}
        defaultParentIdentifier={subIssueParent?.identifier}
      />

      <ConfirmDeleteDialog
        open={!!deleteTargetId}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete this issue?"
        description="This will permanently delete this issue and all its subtasks."
        onConfirm={() => {
          if (deleteTargetId) {
            deleteMutation.mutate(deleteTargetId);
            setDeleteTargetId(null);
          }
        }}
      />

      <ConfirmDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        title={`Delete ${selectedIds.size} selected issues?`}
        description="This will permanently remove the selected issues from your workspace."
        onConfirm={() => {
          for (const id of selectedIds) {
            deleteMutation.mutate(id);
          }
          setSelectedIds(new Set());
          setIsBatchDeleteOpen(false);
        }}
      />
    </div>
  );
}
