import * as React from 'react';
import type { Issue } from '@reka/types';
import { Card, Badge } from '@reka/ui';
import { useUpdateIssue, useDeleteIssue, useMoveIssueToTop } from '../hooks/use-issues';
import { ArrowUpToLine, Trash2 } from 'lucide-react';
import { StatusPicker, StatusIconOnly } from './status-picker';
import { PriorityPicker } from './priority-picker';
import { IssueTypePicker } from './issue-type-picker';
import { AssigneePicker } from './assignee-picker';
import { CyclePicker } from './cycle-picker';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';

interface IssueKanbanBoardProps {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
}

const COLUMNS: { id: string; label: string; status: string }[] = [
  { id: 'backlog', label: 'Backlog', status: 'backlog' },
  { id: 'todo', label: 'Todo', status: 'todo' },
  { id: 'in_progress', label: 'In Progress', status: 'in_progress' },
  { id: 'in_review', label: 'In Review', status: 'in_review' },
  { id: 'ready_to_deploy', label: 'Ready to Deploy', status: 'ready_to_deploy' },
  { id: 'done', label: 'Done', status: 'done' },
  { id: 'canceled', label: 'Canceled', status: 'canceled' },
  { id: 'blocked', label: 'Blocked', status: 'blocked' },
];

export function IssueKanbanBoard({ issues, onSelectIssue }: IssueKanbanBoardProps) {
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const moveMutation = useMoveIssueToTop();
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = React.useState<string | null>(null);

  const dropIssue = (status: string, event: React.DragEvent) => {
    event.preventDefault(); setDropTargetStatus(null);
    const id = event.dataTransfer.getData('text/plain');
    const issue = issues.find(item => item.id === id);
    if (!issue || issue.archivedAt) return;
    if (issue.status === status) moveMutation.mutate(id);
    else updateMutation.mutate({ id, data: { status } }, { onSuccess: () => moveMutation.mutate(id) });
  };
  const columns = React.useMemo(() => {
    const system = new Set(COLUMNS.map((column) => column.id));
    const extraStatuses = [...new Set(issues.map((issue) => issue.status))].filter((status) => !system.has(status))
      .map((status) => {
        const item = issues.find((issue) => issue.status === status)!;
        return { id: status, status, label: item.statusLabel || status.replaceAll('_', ' '), position: item.statusPosition ?? 99 };
      }).sort((a, b) => a.position - b.position);
    return [...COLUMNS, ...extraStatuses];
  }, [issues]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  return (
    <div className="flex gap-3 items-start overflow-x-auto pb-4 select-none">
      {columns.map((col) => {
        const colIssues = issues.filter((i) => i.status === col.id);
        return (
          <div
            key={col.id}
            data-testid={`kanban-column-${col.id}`}
            onDragOver={event => { event.preventDefault(); setDropTargetStatus(col.id); event.dataTransfer.dropEffect = 'move'; }}
            onDragLeave={event => { if (event.currentTarget === event.target) setDropTargetStatus(null); }}
            onDrop={event => dropIssue(col.id, event)}
            className={`flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-2.5 min-h-[500px] w-64 shrink-0 shadow-none transition-colors ${dropTargetStatus === col.id ? 'border-primary bg-accent/40' : ''}`}
          >
            <div className="flex items-center justify-between px-1 py-0.5">
              <div className="flex items-center gap-1.5">
                <StatusIconOnly status={col.status} />
                <span className="text-xs font-semibold tracking-tight text-foreground">
                  {col.label}
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-xs h-4.5 px-1.5 flex items-center justify-center">
                {colIssues.length}
              </Badge>
            </div>

            <div className="flex flex-col gap-2">
              {colIssues.map((issue) => (
                <Card
                  key={issue.id}
                  data-testid={`kanban-issue-${issue.id}`}
                  draggable={!issue.archivedAt}
                  onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', issue.id); }}
                  onDragEnd={() => setDropTargetStatus(null)}
                  onClick={() => onSelectIssue?.(issue)}
                  className="p-3 flex flex-col gap-2 hover:border-foreground/40 transition-colors shadow-2xs cursor-grab active:cursor-grabbing group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <PriorityPicker priority={issue.priority} onPriorityChange={(priority) => updateMutation.mutate({ id: issue.id, data: { priority: priority as Issue['priority'] } })} />
                      <span className="font-mono text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                        {issue.identifier}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                    <button type="button" aria-label={`Move ${issue.identifier} to top`} title="Move to top" onClick={event => { event.stopPropagation(); moveMutation.mutate(issue.id); }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                      <ArrowUpToLine className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(issue.id, e)}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all p-0.5 rounded hover:bg-destructive/10"
                      title="Delete Issue"
                    >
                      <Trash2 className="size-3" />
                    </button>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                    {issue.title}
                  </p>

                  <div><CyclePicker cycleId={issue.cycleId ?? null} teamId={issue.teamId} identifier={issue.identifier} onCycleChange={(cycleId) => updateMutation.mutate({ id: issue.id, data: { cycleId } })} /></div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <IssueTypePicker type={issue.type} identifier={issue.identifier} onTypeChange={(type) => updateMutation.mutate({ id: issue.id, data: { type } })} />

                      <AssigneePicker
                        size="icon"
                        assigneeId={issue.assigneeId}
                        onAssigneeChange={(userId) =>
                          updateMutation.mutate({ id: issue.id, data: { assigneeId: userId } })
                        }
                      />
                    </div>

                    {/* Quick Status Picker Popup */}
                    <StatusPicker
                      teamId={issue.teamId}
                      status={issue.status}
                      onStatusChange={(val) => updateMutation.mutate({ id: issue.id, data: { status: val as any } })}
                    />
                  </div>
                </Card>
              ))}

              {colIssues.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground/50 border border-dashed border-border/30 rounded-md">
                  No issues
                </div>
              )}
            </div>
          </div>
        );
      })}

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
    </div>
  );
}
