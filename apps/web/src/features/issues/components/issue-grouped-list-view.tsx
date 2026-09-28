import * as React from 'react';
import type { Issue } from '@reka/types';
import {
  Badge,
  Checkbox,
  Button,
} from '@reka/ui';
import { useUpdateIssue, useDeleteIssue } from '../hooks/use-issues';
import { useProjects } from '../../projects/hooks/use-projects';
import { useUsers } from '../../users/hooks/use-users';
import {
  Plus,
  ChevronDown,
  Trash2,
  FolderKanban,
  AlertCircle,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Minus,
  CornerDownRight,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { StatusPicker, StatusIconOnly, STATUS_CONFIG } from './status-picker';
import { PriorityPicker } from './issue-list-view';
import { AssigneePicker } from './assignee-picker';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';

interface IssueGroupedListViewProps {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
  onCreateWithStatus?: (status: string) => void;
  focusedIndex?: number;
  onFocusIndex?: (index: number) => void;
}

// Order of status sections matching Linear flow
const STATUS_ORDER: Array<{ key: string; label: string }> = [
  { key: 'in_review', label: 'In Review' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'todo', label: 'Todo' },
  { key: 'backlog', label: 'Backlog' },
  { key: 'ready_to_deploy', label: 'Ready to Deploy' },
  { key: 'done', label: 'Done' },
  { key: 'canceled', label: 'Canceled' },
];

function formatDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const isSameYear = date.getFullYear() === now.getFullYear();

  if (isSameYear) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Consistent avatar background colors based on name string
function getAvatarColor(name: string): string {
  const colors = [
    'bg-emerald-600 text-white',
    'bg-blue-600 text-white',
    'bg-indigo-600 text-white',
    'bg-violet-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white',
    'bg-teal-600 text-white',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function IssueGroupedListView({
  issues,
  onSelectIssue,
  onCreateWithStatus,
  focusedIndex = -1,
  onFocusIndex,
}: IssueGroupedListViewProps) {
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();

  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
  const [expandedSubtasks, setExpandedSubtasks] = React.useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  // Quick lookup maps
  const projectMap = React.useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const userMap = React.useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Separate root issues and subtasks
  const { rootIssues, subtaskMap } = React.useMemo(() => {
    const roots: Issue[] = [];
    const subtasks: Record<string, Issue[]> = {};

    for (const issue of issues) {
      if (issue.parentId) {
        if (!subtasks[issue.parentId]) subtasks[issue.parentId] = [];
        subtasks[issue.parentId].push(issue);
      } else {
        roots.push(issue);
      }
    }
    return { rootIssues: roots, subtaskMap: subtasks };
  }, [issues]);

  // Group root issues by status
  const groupedIssues = React.useMemo(() => {
    const groups = new Map<string, Issue[]>();

    // Initialize all recognized statuses
    for (const item of STATUS_ORDER) {
      groups.set(item.key, []);
    }

    for (const issue of rootIssues) {
      const list = groups.get(issue.status);
      if (list) {
        list.push(issue);
      } else {
        // Unknown or custom status
        if (!groups.has(issue.status)) groups.set(issue.status, []);
        groups.get(issue.status)!.push(issue);
      }
    }

    // Filter to only groups that have issues (or all known active groups if issues exist)
    return STATUS_ORDER.map((item) => ({
      key: item.key,
      label: item.label,
      issues: groups.get(item.key) || [],
    })).filter((g) => g.issues.length > 0);
  }, [rootIssues]);

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSubtasks = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubtasks((prev) => ({ ...prev, [id]: !prev[id] }));
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

  if (issues.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 p-14 text-center text-xs text-muted-foreground bg-card/10">
        No issues found. Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">C</kbd> anywhere to create.
      </div>
    );
  }

  // Linear flat indexing for J/K keyboard navigation
  let currentGlobalIndex = 0;

  return (
    <div className="flex flex-col gap-5 select-none pb-12">
      {groupedIssues.map((group) => {
        const isCollapsed = !!collapsedGroups[group.key];
        const statusConfig = STATUS_CONFIG[group.key] || STATUS_CONFIG.backlog;

        return (
          <div key={group.key} className="flex flex-col">
            {/* Linear-style Sticky Status Section Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between py-1.5 px-2 bg-background/95 backdrop-blur-md border-b border-border/70 rounded-t-[6px]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapse(group.key)}
                  className="size-5 rounded-[4px] flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                  title={isCollapsed ? 'Expand section' : 'Collapse section'}
                >
                  <ChevronDown
                    className={`size-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>

                <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => toggleGroupCollapse(group.key)}>
                  <div className="shrink-0 flex items-center">
                    <StatusIconOnly status={group.key} />
                  </div>
                  <span className="text-xs font-semibold text-foreground tracking-tight">
                    {group.label}
                  </span>
                  <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground ml-1">
                    <span className="text-xs opacity-70">▲</span>
                    <span>{group.issues.length}</span>
                  </div>
                </div>
              </div>

              {/* Right: + Add issue in this status */}
              <button
                type="button"
                onClick={() => onCreateWithStatus?.(group.key)}
                className="size-6 rounded-[4px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={`New issue in ${group.label}`}
              >
                <Plus className="size-3.5" />
              </button>
            </div>

            {/* List of issues under this status */}
            {!isCollapsed && (
              <div className="divide-y divide-border/40 border-b border-border/40">
                {group.issues.map((issue) => {
                  const globalIdx = currentGlobalIndex++;
                  const isFocused = focusedIndex === globalIdx;
                  const isChecked = selectedIds.has(issue.id);
                  const subtasks = subtaskMap[issue.id] || [];
                  const hasSubtasks = subtasks.length > 0;
                  const isSubtasksExpanded = !!expandedSubtasks[issue.id];
                  const project = issue.projectId ? projectMap.get(issue.projectId) : null;
                  const assignee = issue.assigneeId ? userMap.get(issue.assigneeId) : null;

                  return (
                    <React.Fragment key={issue.id}>
                      <div
                        onClick={() => {
                          onFocusIndex?.(globalIdx);
                          onSelectIssue?.(issue);
                        }}
                        className={`flex items-center justify-between px-2.5 py-2 transition-colors text-xs gap-3 cursor-pointer group relative ${
                          isFocused
                            ? 'bg-secondary/70'
                            : isChecked
                            ? 'bg-secondary/40'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        {/* J/K selection strip */}
                        {isFocused && (
                          <div className="absolute left-0 inset-y-0 w-0.5 bg-primary" />
                        )}

                        {/* Left: Checkbox, Priority, Identifier, Status Icon, Title */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Subtask chevron toggle */}
                          {hasSubtasks ? (
                            <button
                              type="button"
                              onClick={(e) => toggleSubtasks(issue.id, e)}
                              className="size-4.5 rounded-[4px] flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition-colors"
                              title={isSubtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                            >
                              <ChevronRight
                                className={`size-3 transition-transform duration-150 ${
                                  isSubtasksExpanded ? 'rotate-90' : ''
                                }`}
                              />
                            </button>
                          ) : (
                            <div className="size-4.5 shrink-0" />
                          )}

                          <Checkbox
                            aria-label={`Select issue ${issue.identifier}`}
                            checked={isChecked}
                            onClick={(e) => handleToggleSelect(issue.id, e)}
                            className="cursor-pointer shrink-0 rounded-[4px]"
                          />

                          <PriorityPicker
                            priority={issue.priority}
                            onPriorityChange={(newPriority) =>
                              updateMutation.mutate({ id: issue.id, data: { priority: newPriority as any } })
                            }
                          />

                          <span className="font-mono text-xs text-muted-foreground font-medium shrink-0 group-hover:text-foreground transition-colors">
                            {issue.identifier}
                          </span>

                          <StatusPicker
                            status={issue.status}
                            className="size-5"
                            onStatusChange={(newStatus) =>
                              updateMutation.mutate({ id: issue.id, data: { status: newStatus as any } })
                            }
                          />

                          <span className="font-medium text-foreground truncate tracking-tight">
                            {issue.title}
                          </span>

                          {/* GitHub Issue Tag */}
                          {issue.githubIssueNumber && (
                            <span className="font-mono text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-1 py-0.2 rounded shrink-0">
                              GH #{issue.githubIssueNumber}
                            </span>
                          )}

                          {/* Subtask count badge */}
                          {hasSubtasks && (
                            <span
                              onClick={(e) => toggleSubtasks(issue.id, e)}
                              className="text-xs font-mono text-muted-foreground/80 bg-secondary/60 hover:bg-secondary border border-border/50 px-1.5 py-0.2 rounded-[4px] shrink-0"
                            >
                              {subtasks.filter((s) => s.status === 'done').length}/{subtasks.length}
                            </span>
                          )}
                        </div>

                        {/* Right: Label / Type chip, Project pill, Assignee avatar, Date */}
                        <div
                          className="flex items-center gap-3 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Label / Type pill (Linear style: colored dot + label) */}
                          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/70 border border-border/50 text-xs text-muted-foreground font-normal">
                            <span
                              className={`size-1.5 rounded-full ${
                                issue.type === 'bug'
                                  ? 'bg-rose-500'
                                  : issue.type === 'feature'
                                  ? 'bg-indigo-500'
                                  : issue.type === 'improvement'
                                  ? 'bg-cyan-500'
                                  : 'bg-amber-400'
                              }`}
                            />
                            <span className="capitalize">{issue.type}</span>
                          </div>

                          {/* Project pill badge */}
                          {project && (
                            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/50 border border-border/50 text-xs text-muted-foreground max-w-[200px] truncate hover:text-foreground transition-colors">
                              <FolderKanban className="size-3 text-muted-foreground/80 shrink-0" />
                              <span className="truncate">{project.name}</span>
                            </div>
                          )}

                          {/* Assignee Picker / Avatar */}
                          <div className="flex items-center">
                            {assignee ? (
                              <div
                                title={`Assigned to ${assignee.name}`}
                                className={`size-5 rounded-full flex items-center justify-center text-xs font-semibold tracking-tighter ${getAvatarColor(
                                  assignee.name,
                                )}`}
                              >
                                {getInitials(assignee.name)}
                              </div>
                            ) : (
                              <AssigneePicker
                                size="icon"
                                assigneeId={issue.assigneeId}
                                onAssigneeChange={(userId) =>
                                  updateMutation.mutate({ id: issue.id, data: { assigneeId: userId } })
                                }
                              />
                            )}
                          </div>

                          {/* Date (e.g. "Dec 2023", "Sep 17") */}
                          <span className="font-mono text-xs text-muted-foreground/70 w-16 text-right shrink-0">
                            {formatDate(issue.createdAt)}
                          </span>

                          {/* Quick delete button on hover */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTargetId(issue.id);
                            }}
                            className="text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                            title="Delete issue"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Sub-tasks rendering if expanded */}
                      {hasSubtasks && isSubtasksExpanded && (
                        <div className="ml-5 border-l border-border/50 bg-secondary/15 divide-y divide-border/30">
                          {subtasks.map((st) => (
                            <div
                              key={st.id}
                              onClick={() => onSelectIssue?.(st)}
                              className="flex items-center justify-between pl-6 pr-3 py-1.5 hover:bg-secondary/40 transition-colors text-xs gap-3 cursor-pointer group/sub"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <CornerDownRight className="size-3 text-muted-foreground/40 shrink-0" />
                                <span className="font-mono text-xs text-muted-foreground font-medium shrink-0">
                                  {st.identifier}
                                </span>
                                <StatusPicker
                                  status={st.status}
                                  className="size-4.5"
                                  onStatusChange={(newStatus) =>
                                    updateMutation.mutate({ id: st.id, data: { status: newStatus as any } })
                                  }
                                />
                                <span className="truncate text-muted-foreground group-hover/sub:text-foreground">
                                  {st.title}
                                </span>
                              </div>
                              <span className="font-mono text-xs text-muted-foreground/60">
                                {formatDate(st.createdAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Issue"
        description="Are you sure you want to permanently delete this issue? This cannot be undone."
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
