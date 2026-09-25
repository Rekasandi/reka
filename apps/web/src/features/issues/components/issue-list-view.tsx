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
  Button,
} from '@reka/ui';
import { useUpdateIssue, useDeleteIssue } from '../hooks/use-issues';
import {
  Trash2,
  SignalMedium,
  SignalLow,
  Check,
  ChevronRight,
  CornerDownRight,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight,
  X,
} from 'lucide-react';
import { StatusPicker, STATUS_CONFIG } from './status-picker';

interface IssueListViewProps {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
  focusedIndex?: number;
  onFocusIndex?: (index: number) => void;
}

export function PriorityIcon({ priority }: { priority: string }) {
  if (priority === 'urgent') {
    return (
      <div className="size-4 rounded-[4px] bg-red-500/15 text-red-500 flex items-center justify-center font-bold text-[10px] shrink-0 border border-red-500/20" title="Urgent">
        !
      </div>
    );
  }
  if (priority === 'high') {
    return (
      <div className="size-4 rounded-[4px] bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-[10px] shrink-0 border border-amber-500/20" title="High Priority">
        !
      </div>
    );
  }
  if (priority === 'medium') {
    return (
      <span title="Medium Priority" className="size-4 shrink-0 flex items-center justify-center">
        <SignalMedium className="size-3.5 text-muted-foreground/80" />
      </span>
    );
  }
  if (priority === 'low') {
    return (
      <span title="Low Priority" className="size-4 shrink-0 flex items-center justify-center">
        <SignalLow className="size-3.5 text-muted-foreground/50" />
      </span>
    );
  }
  return <div className="size-3.5 rounded-full border border-border/70 shrink-0" title="No Priority" />;
}

const PRIORITY_CONFIG = [
  { key: 'urgent', label: 'Urgent' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
  { key: 'no_priority', label: 'None' },
] as const;

export function PriorityPicker({
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
          className={`flex size-6 items-center justify-center rounded-[5px] hover:bg-secondary/80 transition-colors outline-hidden ${className || ''}`}
          title="Change priority (P)"
        >
          <PriorityIcon priority={priority} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-44 p-1 bg-popover border border-border text-foreground shadow-xl rounded-[10px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1 flex items-center justify-between">
          <span>Priority</span>
          <kbd className="font-mono text-[9px] bg-muted px-1 rounded border border-border">P</kbd>
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
                className={`flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-xs cursor-pointer select-none transition-colors ${
                  isSelected ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <div className="shrink-0">
                  <PriorityIcon priority={item.key} />
                </div>
                <span className="flex-1 truncate">{item.label}</span>
                {isSelected && <Check className="size-3 text-foreground mr-0.5" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IssueListView({
  issues,
  onSelectIssue,
  focusedIndex = -1,
  onFocusIndex,
}: IssueListViewProps) {
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const [expandedIssues, setExpandedIssues] = React.useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIssues((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this issue?')) {
      deleteMutation.mutate(id);
    }
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

  const handleBatchStatus = (status: any) => {
    for (const id of selectedIds) {
      updateMutation.mutate({ id, data: { status } });
    }
    setSelectedIds(new Set());
  };

  const handleBatchPriority = (priority: any) => {
    for (const id of selectedIds) {
      updateMutation.mutate({ id, data: { priority } });
    }
    setSelectedIds(new Set());
  };

  const handleBatchDelete = () => {
    if (confirm(`Delete ${selectedIds.size} selected issues?`)) {
      for (const id of selectedIds) {
        deleteMutation.mutate(id);
      }
      setSelectedIds(new Set());
    }
  };

  if (issues.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-border/80 p-14 text-center text-xs text-muted-foreground bg-card/10">
        No issues found. Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">C</kbd> anywhere to create.
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="rounded-[12px] border border-border/80 divide-y divide-border/60 bg-card/30 overflow-hidden select-none shadow-2xs">
        {rootIssues.map((issue, idx) => {
          const subtasks = subtasksByParent[issue.id] || [];
          const hasSubtasks = subtasks.length > 0;
          const isExpanded = !!expandedIssues[issue.id];
          const isFocused = focusedIndex === idx;
          const isChecked = selectedIds.has(issue.id);
          const doneSubtasksCount = subtasks.filter((s) => s.status === 'done').length;

          return (
            <React.Fragment key={issue.id}>
              {/* Parent Row */}
              <div
                onClick={() => {
                  onFocusIndex?.(idx);
                  onSelectIssue?.(issue);
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 transition-colors text-xs gap-3 cursor-pointer group relative ${
                  isFocused
                    ? 'bg-secondary/70 ring-1 ring-inset ring-primary/40'
                    : isChecked
                    ? 'bg-secondary/40'
                    : 'hover:bg-secondary/30'
                }`}
              >
                {/* Visual J/K indicator strip */}
                {isFocused && (
                  <div className="absolute left-0 inset-y-0 w-0.5 bg-primary" />
                )}

                {/* Left section: Expand Toggle, Checkbox, Priority, ID, Status, Title */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                    <div className="size-5 shrink-0" />
                  )}

                  <Checkbox
                    aria-label={`Select issue ${issue.identifier}`}
                    checked={isChecked}
                    onClick={(e) => handleToggleSelect(issue.id, e)}
                    className="cursor-pointer shrink-0 rounded-[4px]"
                  />

                  <PriorityPicker
                    priority={issue.priority}
                    onPriorityChange={(newPriority) => updateMutation.mutate({ id: issue.id, data: { priority: newPriority as any } })}
                  />

                  <span className="font-mono text-[11px] text-muted-foreground font-semibold shrink-0 group-hover:text-foreground/80 transition-colors">
                    {issue.identifier}
                  </span>

                  {/* Status Picker: Quick compact icon */}
                  <StatusPicker
                    status={issue.status}
                    className="size-6"
                    onStatusChange={(newStatus) => updateMutation.mutate({ id: issue.id, data: { status: newStatus as any } })}
                  />

                  <span className="font-medium text-foreground truncate group-hover:text-foreground transition-colors tracking-tight">
                    {issue.title}
                  </span>

                  {/* GitHub Issue Linked Badge */}
                  {issue.githubIssueNumber && (
                    <span className="font-mono text-[10px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded shrink-0">
                      GH #{issue.githubIssueNumber}
                    </span>
                  )}

                  {/* Subtask Count Tag on Parent */}
                  {hasSubtasks && (
                    <span
                      onClick={(e) => toggleExpand(issue.id, e)}
                      className="ml-1 text-[10px] font-mono text-muted-foreground/80 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.2 rounded-[4px] shrink-0"
                      title={`${doneSubtasksCount} of ${subtasks.length} sub-tasks completed`}
                    >
                      {doneSubtasksCount}/{subtasks.length}
                    </span>
                  )}
                </div>

                {/* Right section: Type, Delete action */}
                <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Badge variant="outline" className="capitalize text-[10px] font-mono h-5 px-2 font-normal rounded-[5px] border-border/70 bg-background/50 text-muted-foreground">
                    {issue.type}
                  </Badge>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(issue.id, e)}
                    className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-[4px] hover:bg-destructive/10"
                    title="Delete issue"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-tasks Nested Sub-list */}
              {hasSubtasks && isExpanded && (
                <div className="bg-secondary/15 divide-y divide-border/30 border-t border-border/40">
                  {subtasks.map((st) => {
                    const isDone = st.status === 'done';
                    return (
                      <div
                        key={st.id}
                        onClick={() => onSelectIssue?.(st)}
                        className="flex items-center justify-between pl-8 pr-3.5 py-2 hover:bg-secondary/40 transition-colors text-xs gap-3 cursor-pointer group/sub"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
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

                          <span className="font-mono text-[10px] text-muted-foreground/70 font-semibold shrink-0">
                            {st.identifier}
                          </span>

                          <StatusPicker
                            status={st.status}
                            className="size-5"
                            onStatusChange={(newStatus) => updateMutation.mutate({ id: st.id, data: { status: newStatus as any } })}
                          />

                          <span className={`truncate text-xs ${isDone ? 'line-through text-muted-foreground/70' : 'text-foreground/90 font-normal'}`}>
                            {st.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(st.id, e)}
                            className="text-muted-foreground/20 hover:text-destructive opacity-0 group-hover/sub:opacity-100 transition-opacity p-1 rounded-[4px]"
                            title="Delete sub-task"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-popover/95 backdrop-blur-md border border-border px-4 py-2 rounded-[10px] shadow-2xl text-xs select-none animate-in fade-in-0 slide-in-from-bottom-4">
          <div className="flex items-center gap-2 font-mono font-medium text-foreground">
            <span className="size-5 rounded-[4px] bg-primary text-primary-foreground flex items-center justify-center text-[11px]">
              {selectedIds.size}
            </span>
            <span>selected</span>
          </div>

          <div className="h-4 w-px bg-border/80" />

          {/* Batch Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="h-7 text-xs">
                Status...
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-40 p-1">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <DropdownMenuItem key={key} onClick={() => handleBatchStatus(key)} className="text-xs gap-2">
                  {cfg.renderIcon()}
                  <span>{cfg.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Batch Priority Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="h-7 text-xs">
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
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3" />
            <span>Delete</span>
          </Button>

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="p-1 rounded text-muted-foreground hover:text-foreground"
            title="Clear selection (Esc)"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
