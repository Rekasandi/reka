import * as React from 'react';
import type { Issue } from '@reka/types';
import {
  Badge,
  Checkbox,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@reka/ui';
import { useUpdateIssue, useDeleteIssue } from '../hooks/use-issues';
import { Trash2, SignalMedium, SignalLow, Check } from 'lucide-react';
import { StatusPicker } from './status-picker';

interface IssueListViewProps {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
}

export function PriorityIcon({ priority }: { priority: string }) {
  if (priority === 'urgent') {
    return (
      <div className="size-4 rounded-[3px] bg-red-500/20 text-red-500 flex items-center justify-center font-bold text-[10px] shrink-0" title="Urgent">
        !
      </div>
    );
  }
  if (priority === 'high') {
    return (
      <div className="size-4 rounded-[3px] bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-[10px] shrink-0" title="High Priority">
        !
      </div>
    );
  }
  if (priority === 'medium') {
    return (
      <span title="Medium Priority" className="shrink-0 flex items-center justify-center">
        <SignalMedium className="size-3.5 text-muted-foreground/70" />
      </span>
    );
  }
  if (priority === 'low') {
    return (
      <span title="Low Priority" className="shrink-0 flex items-center justify-center">
        <SignalLow className="size-3.5 text-muted-foreground/50" />
      </span>
    );
  }
  return <div className="size-3.5 rounded-full border border-border/40 shrink-0" title="No Priority" />;
}

const PRIORITY_CONFIG = [
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
  { key: 'no_priority', label: 'None' },
] as const;

function PriorityPicker({
  priority,
  onPriorityChange,
  className,
}: {
  priority: string;
  onPriorityChange: (priority: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`flex size-6 items-center justify-center rounded-[4px] hover:bg-secondary transition-colors outline-hidden ${className || ''}`}
          title="Change priority"
        >
          <PriorityIcon priority={priority} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-48 p-1.5 bg-[#18181b] border border-border text-foreground shadow-2xl rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-2.5 py-1.5 text-xs text-muted-foreground border-b border-border/40 mb-1">
          <span className="font-medium text-[11px] text-muted-foreground/80">Change priority...</span>
        </div>

        <DropdownMenuGroup>
          {PRIORITY_CONFIG.map((item) => {
            const isSelected = priority === item.key;
            return (
              <DropdownMenuItem
                key={item.key}
                onClick={() => {
                  onPriorityChange(item.key);
                  setOpen(false);
                }}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                  isSelected ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <div className="shrink-0">
                  <PriorityIcon priority={item.key} />
                </div>
                <span className="flex-1 truncate">{item.label}</span>
                {isSelected && <Check className="size-3 text-muted-foreground mr-1" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IssueListView({ issues, onSelectIssue }: IssueListViewProps) {
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this issue?')) {
      deleteMutation.mutate(id);
    }
  };

  if (issues.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
        No issues found. Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">C</kbd> or click New Issue to create one.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border divide-y divide-border/60 bg-card overflow-hidden select-none">
      {issues.map((issue) => (
        <div
          key={issue.id}
          onClick={() => onSelectIssue?.(issue)}
          className="flex items-center justify-between px-3 py-2 hover:bg-secondary/40 transition-colors text-xs gap-3 cursor-pointer group"
        >
          {/* Left section: Checkbox, Priority, ID, Status Icon Only, Title */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Checkbox
              aria-label={`Select issue ${issue.identifier}`}
              onClick={(e) => e.stopPropagation()}
              className="cursor-pointer shrink-0"
            />

            <PriorityPicker
              priority={issue.priority}
              onPriorityChange={(newPriority) => updateMutation.mutate({ id: issue.id, data: { priority: newPriority as any } })}
            />

            <span className="font-mono text-[11px] text-muted-foreground font-semibold shrink-0">
              {issue.identifier}
            </span>

            {/* Status: ONLY Icon, clicks to open popup like screenshot */}
            <StatusPicker
              status={issue.status}
              onStatusChange={(newStatus) => updateMutation.mutate({ id: issue.id, data: { status: newStatus as any } })}
            />

            <span className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {issue.title}
            </span>
          </div>

          {/* Right section: Type, Delete */}
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge variant="secondary" className="capitalize text-[10px] font-mono h-5 px-1.5 font-normal">
              {issue.type}
            </Badge>

            <button
              type="button"
              onClick={(e) => handleDelete(issue.id, e)}
              className="text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all p-1 rounded"
              title="Delete issue"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
