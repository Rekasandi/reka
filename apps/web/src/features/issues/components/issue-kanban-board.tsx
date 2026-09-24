import * as React from 'react';
import type { Issue } from '@reka/types';
import { Card, Badge } from '@reka/ui';
import { useUpdateIssue, useDeleteIssue } from '../hooks/use-issues';
import { Trash2 } from 'lucide-react';
import { StatusPicker, StatusIconOnly } from './status-picker';
import { PriorityIcon } from './issue-list-view';

interface IssueKanbanBoardProps {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
}

const COLUMNS: { id: string; label: string; status: string }[] = [
  { id: 'backlog', label: 'Backlog', status: 'backlog' },
  { id: 'todo', label: 'Todo', status: 'todo' },
  { id: 'in_progress', label: 'In Progress', status: 'in_progress' },
  { id: 'in_review', label: 'In Review', status: 'in_review' },
  { id: 'done', label: 'Done', status: 'done' },
];

export function IssueKanbanBoard({ issues, onSelectIssue }: IssueKanbanBoardProps) {
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this issue?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start overflow-x-auto pb-4 select-none">
      {COLUMNS.map((col) => {
        const colIssues = issues.filter((i) => i.status === col.id);
        return (
          <div
            key={col.id}
            className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/20 p-2.5 min-h-[500px]"
          >
            <div className="flex items-center justify-between px-1 py-0.5">
              <div className="flex items-center gap-1.5">
                <StatusIconOnly status={col.status} />
                <span className="text-xs font-semibold tracking-tight text-foreground">
                  {col.label}
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] h-4.5 px-1.5 flex items-center justify-center">
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
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
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
                    <Badge variant="secondary" className="capitalize text-[10px] font-mono h-4.5 px-1.5 font-normal">
                      {issue.type}
                    </Badge>

                    {/* Quick Status Picker Popup */}
                    <StatusPicker
                      status={issue.status}
                      onStatusChange={(val) => updateMutation.mutate({ id: issue.id, data: { status: val as any } })}
                    />
                  </div>
                </Card>
              ))}

              {colIssues.length === 0 && (
                <div className="py-8 text-center text-[11px] text-muted-foreground/50 border border-dashed border-border/30 rounded-md">
                  No issues
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
