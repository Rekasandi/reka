import * as React from 'react';
import { getIssueStatusCategory, type Issue } from '@reka/types';
import { Checkbox } from '@reka/ui';
import { useUpdateIssue, useDeleteIssue, useArchiveIssue, useMoveIssueToTop } from '../hooks/use-issues';
import {
  Plus,
  ChevronDown,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { StatusPicker, StatusIconOnly, STATUS_CONFIG } from './status-picker';
import { PriorityPicker } from './priority-picker';
import { IssueRowProperties } from './issue-row-properties';
import { IssueContextMenu } from './issue-context-menu';
import { CreateIssueDialog } from './create-issue-dialog';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';

interface IssueGroupedListViewProps {
  issues: Issue[];
  onSelectIssue?: (issue: Issue) => void;
  onCreateWithStatus?: (status: string) => void;
  focusedIndex?: number;
  onFocusIndex?: (index: number) => void;
  showSubtasks?: boolean;
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

export function IssueGroupedListView({
  issues,
  onSelectIssue,
  onCreateWithStatus,
  focusedIndex = -1,
  onFocusIndex,
  showSubtasks = true,
}: IssueGroupedListViewProps) {
  const updateMutation = useUpdateIssue();
  const deleteMutation = useDeleteIssue();
  const archiveMutation = useArchiveIssue();
  const moveMutation = useMoveIssueToTop();

  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
  const [expandedSubtasks, setExpandedSubtasks] = React.useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [subIssueParent, setSubIssueParent] = React.useState<Issue | null>(null);

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

    // Preserve system ordering and surface team-configured states after built-ins.
    const known = STATUS_ORDER.map((item) => ({ key: item.key, label: item.label, issues: groups.get(item.key) || [] }));
    const custom = [...groups.keys()].filter((key) => !STATUS_ORDER.some((item) => item.key === key))
      .map((key) => {
        const items = groups.get(key) || [];
        return { key, label: items[0]?.statusLabel || key.replaceAll('_', ' '), issues: items };
      }).sort((a, b) => (a.issues[0]?.statusPosition ?? 99) - (b.issues[0]?.statusPosition ?? 99));
    return [...known, ...custom].filter((group) => group.issues.length > 0);
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

  const renderSubtasks = (parent: Issue, depth = 0): React.ReactNode => {
    const children = subtaskMap[parent.id] ?? [];
    if (!children.length || !expandedSubtasks[parent.id]) return null;

    return (
      <div className="bg-secondary/10 divide-y divide-border/30">
        {children.map((subtask) => {
          const nested = (subtaskMap[subtask.id] ?? []).length > 0;
          const selected = selectedIds.has(subtask.id);
          const expanded = !!expandedSubtasks[subtask.id];
          return (
            <React.Fragment key={subtask.id}>
              <IssueContextMenu issue={subtask} onOpen={onSelectIssue ? () => onSelectIssue(subtask) : undefined}
                onAddSubIssue={() => setSubIssueParent(subtask)} onUpdate={data => updateMutation.mutate({ id: subtask.id, data })} onDelete={() => setDeleteTargetId(subtask.id)} onArchive={() => archiveMutation.mutate({ id: subtask.id, restore: !!subtask.archivedAt })} onMoveToTop={() => moveMutation.mutate(subtask.id)}>
              <div
                onClick={() => onSelectIssue?.(subtask)}
                className={`issue-work-row group/sub flex min-w-0 items-center justify-between gap-3 px-2 py-1.5 text-xs transition-colors hover:bg-secondary/40 ${selected ? 'bg-secondary/40' : ''}`}

              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Checkbox
                    aria-label={`Select issue ${subtask.identifier}`}
                    checked={selected}
                    onClick={(event) => handleToggleSelect(subtask.id, event)}
                    className="size-4 shrink-0 rounded-[4px] opacity-0 transition-opacity group-hover/sub:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 [@media(hover:none)]:opacity-100"
                  />
                  <div className="issue-row-main flex min-w-0 flex-1 items-center gap-2" style={{ marginLeft: `${36 + depth * 16}px` }}>
                  {nested ? (
                    <button type="button" onClick={(event) => toggleSubtasks(subtask.id, event)}
                      className="flex size-5 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} sub-issues for ${subtask.identifier}`}
                      aria-expanded={expanded}>
                      <ChevronRight className={`size-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                  ) : <span className="size-5 shrink-0" aria-hidden="true" />}
                  <PriorityPicker priority={subtask.priority} onPriorityChange={(priority) => updateMutation.mutate({ id: subtask.id, data: { priority: priority as any } })} />
                  <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">{subtask.identifier}</span>
                  <StatusPicker teamId={subtask.teamId} status={subtask.status} appearance="badge" onStatusChange={(status) => updateMutation.mutate({ id: subtask.id, data: { status: status as any } })} />
                  <button type="button" className="issue-row-title min-w-0 truncate rounded-sm text-left text-muted-foreground group-hover/sub:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open issue ${subtask.identifier}: ${subtask.title}`} title={subtask.title}>{subtask.title}</button>
                  {nested && <span className="shrink-0 rounded-[4px] border border-border/50 bg-secondary/60 px-1.5 py-0.2 font-mono text-xs text-muted-foreground">{childrenDoneCount(subtask)}/{subtaskMap[subtask.id].length}</span>}
                  </div>
                </div>
                <div className="issue-row-meta flex shrink-0 items-center gap-1.5 sm:gap-3">
                  <IssueRowProperties issue={subtask} onUpdate={(data) => updateMutation.mutate({ id: subtask.id, data })} />
                  <span className="hidden w-16 shrink-0 text-right font-mono text-xs text-muted-foreground/70 sm:inline">{formatDate(subtask.createdAt)}</span>
                  <button type="button" onClick={(event) => { event.stopPropagation(); setDeleteTargetId(subtask.id); }}
                    className="rounded-[4px] p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/sub:opacity-100 focus-visible:opacity-100"
                    title="Delete sub-issue" aria-label={`Delete sub-issue ${subtask.identifier}`}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              </IssueContextMenu>
              {renderSubtasks(subtask, depth + 1)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const childrenDoneCount = (parent: Issue) => (subtaskMap[parent.id] ?? []).filter((item) => getIssueStatusCategory(item) === 'completed').length;

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
    <div className="issue-work-surface flex flex-col gap-5 select-none pb-12">
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
                  className="size-5 shrink-0 rounded-[4px] flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                  title={isCollapsed ? 'Expand section' : 'Collapse section'}
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${group.label} issues`}
                  aria-expanded={!isCollapsed}
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
                aria-label={`New issue in ${group.label}`}
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
                  const subtasks = showSubtasks ? (subtaskMap[issue.id] || []) : [];
                  const hasSubtasks = subtasks.length > 0;
                  const isSubtasksExpanded = !!expandedSubtasks[issue.id];

                  return (
                    <React.Fragment key={issue.id}>
                      <IssueContextMenu issue={issue} onOpen={onSelectIssue ? () => onSelectIssue(issue) : undefined}
                        onAddSubIssue={() => setSubIssueParent(issue)} onUpdate={data => updateMutation.mutate({ id: issue.id, data })} onDelete={() => setDeleteTargetId(issue.id)} onArchive={() => archiveMutation.mutate({ id: issue.id, restore: !!issue.archivedAt })} onMoveToTop={() => moveMutation.mutate(issue.id)}>
                      <div
                        onClick={() => {
                          onFocusIndex?.(globalIdx);
                          onSelectIssue?.(issue);
                        }}
                        data-testid={`issue-row-${issue.id}`}
                        className={`issue-work-row flex items-center justify-between px-2 py-2 transition-colors text-xs gap-3 cursor-pointer group relative ${
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
                        <div className="issue-row-main flex items-center gap-2.5 min-w-0 flex-1">
                          <Checkbox
                            aria-label={`Select issue ${issue.identifier}`}
                            checked={isChecked}
                            onClick={(e) => handleToggleSelect(issue.id, e)}
                            className="cursor-pointer shrink-0 rounded-[4px] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 [@media(hover:none)]:opacity-100"
                          />

                          {/* Subtask chevron toggle */}
                          {hasSubtasks ? (
                            <button
                              type="button"
                              onClick={(e) => toggleSubtasks(issue.id, e)}
                              className="size-5 shrink-0 rounded-[4px] flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-secondary transition-colors"
                              title={isSubtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                            >
                              <ChevronRight
                                className={`size-3.5 transition-transform duration-150 ${
                                  isSubtasksExpanded ? 'rotate-90' : ''
                                }`}
                              />
                            </button>
                          ) : (
                            <div className="size-5 shrink-0" aria-hidden="true" />
                          )}

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
                            teamId={issue.teamId}
                            status={issue.status}
                            appearance="badge"
                            onStatusChange={(newStatus) =>
                              updateMutation.mutate({ id: issue.id, data: { status: newStatus as any } })
                            }
                          />

                          <button type="button" className="issue-row-title truncate rounded-sm text-left font-medium tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open issue ${issue.identifier}: ${issue.title}`} title={issue.title}>
                            {issue.title}
                          </button>

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
                              {subtasks.filter((subtask) => getIssueStatusCategory(subtask) === 'completed').length}/{subtasks.length}
                            </span>
                          )}
                        </div>

                        {/* Right: Label / Type chip, Project pill, Assignee avatar, Date */}
                        <div
                          className="issue-row-meta flex items-center gap-1.5 sm:gap-3 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IssueRowProperties
                            issue={issue}
                            onUpdate={(data) => updateMutation.mutate({ id: issue.id, data })}
                          />

                          {/* Date (e.g. "Dec 2023", "Sep 17") */}
                          <span className="hidden sm:inline font-mono text-xs text-muted-foreground/70 w-16 text-right shrink-0">
                            {formatDate(issue.createdAt)}
                          </span>

                          {/* Quick delete button on hover */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTargetId(issue.id);
                            }}
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
                            title="Delete issue"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      </IssueContextMenu>

                      {hasSubtasks && isSubtasksExpanded && renderSubtasks(issue)}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <CreateIssueDialog
        open={!!subIssueParent}
        onOpenChange={open => !open && setSubIssueParent(null)}
        defaultTeamId={subIssueParent?.teamId}
        defaultParentId={subIssueParent?.id}
        defaultParentIdentifier={subIssueParent?.identifier}
      />

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
