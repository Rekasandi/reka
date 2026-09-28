import * as React from 'react';
import type { Issue } from '@reka/types';
import { Card, Badge } from '@reka/ui';
import { useUpdateIssue, useDeleteIssue } from '../hooks/use-issues';
import { Trash2 } from 'lucide-react';
import { StatusPicker, StatusIconOnly } from './status-picker';
import { PriorityIcon } from './issue-list-view';
import { AssigneePicker } from './assignee-picker';
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
];

export function IssueKanbanBoard({ issues, onSelectIssue }: IssueKanbanBoardProps) {
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  return (
    <div className="flex gap-3 items-start overflow-x-auto pb-4 select-none">
      {COLUMNS.map((col) => {
        const colIssues = issues.filter((i) => i.status === col.id);
        return (
          <div
            key={col.id}
            className="flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-2.5 min-h-[500px] w-64 shrink-0 shadow-none"
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
                  onClick={() => onSelectIssue?.(issue)}
                  className="p-3 flex flex-col gap-2 hover:border-foreground/40 transition-colors shadow-2xs cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      <PriorityIcon priority={issue.priority} />
                      <span className="font-mono text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                        {issue.identifier}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(issue.id, e)}
                      className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded"
                      title="Delete Issue"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>

                  <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                    {issue.title}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="capitalize text-xs font-mono h-4.5 px-1.5 font-normal">
                        {issue.type}
                      </Badge>

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
