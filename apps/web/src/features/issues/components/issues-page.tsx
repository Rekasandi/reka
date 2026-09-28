import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Skeleton, Input } from '@reka/ui';
import { Plus, LayoutGrid, List, RefreshCw, Search, Layers } from 'lucide-react';
import { useIssues, useUpdateIssue } from '../hooks/use-issues';
import { useUsers } from '../../users/hooks/use-users';
import { useAuthStore } from '../../../stores/auth.store';
import { CreateIssueDialog } from './create-issue-dialog';
import { IssueDetailSheet } from './issue-detail-sheet';
import { IssueListView } from './issue-list-view';
import { IssueGroupedListView } from './issue-grouped-list-view';
import { IssueKanbanBoard } from './issue-kanban-board';
import type { Issue } from '@reka/types';

interface IssuesPageProps {
  teamId?: string;
}

export function IssuesPage({ teamId }: IssuesPageProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  const isMyIssues = location.pathname === '/my-issues';

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grouped' | 'list' | 'board'>('grouped');
  const [createStatus, setCreateStatus] = React.useState<string | undefined>(undefined);
  const [filterTab, setFilterTab] = React.useState('all');

  // Search & Sorting
  const [searchQuery, setSearchQuery] = React.useState('');
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { data: issues = [], isLoading, isError, refetch } = useIssues();
  const { data: users = [] } = useUsers();
  const updateMutation = useUpdateIssue();

  const handleOpenDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDetailOpen(true);
  };

  // Scope to my-issues if on that route
  const scopedIssues = React.useMemo(() => {
    if (teamId) return issues.filter((issue) => issue.teamId === teamId);

    if (isMyIssues) {
      if (!user) return issues.filter((i) => i.status !== 'done' && i.status !== 'canceled');
      const assigned = issues.filter((i) => i.assigneeId === user.id);
      return assigned.length > 0
        ? assigned
        : issues.filter((i) => i.status === 'in_progress' || i.status === 'todo');
    }
    return issues;
  }, [issues, isMyIssues, teamId, user]);

  // Filter options with dynamic counts
  const filterOptions = React.useMemo(() => [
    { id: 'all', label: 'All', count: scopedIssues.length },
    {
      id: 'active',
      label: 'Active',
      count: scopedIssues.filter((i) => i.status !== 'backlog' && i.status !== 'done' && i.status !== 'canceled').length,
    },
    {
      id: 'backlog',
      label: 'Backlog',
      count: scopedIssues.filter((i) => i.status === 'backlog').length,
    },
    {
      id: 'done',
      label: 'Done',
      count: scopedIssues.filter((i) => i.status === 'done' || i.status === 'canceled').length,
    },
  ], [scopedIssues]);

  // Filtered issues by Tab + Search Query
  const filteredIssues = React.useMemo(() => {
    let list = scopedIssues;
    if (filterTab === 'active') {
      list = scopedIssues.filter((i) => i.status === 'todo' || i.status === 'in_progress' || i.status === 'in_review');
    } else if (filterTab === 'backlog') {
      list = scopedIssues.filter((i) => i.status === 'backlog');
    } else if (filterTab === 'done') {
      list = scopedIssues.filter((i) => i.status === 'done' || i.status === 'canceled');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.identifier.toLowerCase().includes(q),
      );
    }

    return list;
  }, [scopedIssues, filterTab, searchQuery]);

  // Linear Keyboard Shortcuts: 'C' (New), '/' (Search), 'J'/'K' (Navigate), 'Space'/'Enter' (Open)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // '/' to focus search
      if (!isInput && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // 'c' or 'C' to open new issue dialog
      if (!isInput && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setIsCreateOpen(true);
        return;
      }

      // Linear J / K Keyboard Navigation across list
      if (!isInput && (viewMode === 'list' || viewMode === 'grouped') && filteredIssues.length > 0) {
        if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, filteredIssues.length - 1));
        } else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (filteredIssues[focusedIndex]) {
            handleOpenDetail(filteredIssues[focusedIndex]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, filteredIssues, focusedIndex]);

  const assigneeCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of scopedIssues.filter((issue) => issue.status !== 'done' && issue.status !== 'canceled')) {
      counts.set(issue.assigneeId || 'unassigned', (counts.get(issue.assigneeId || 'unassigned') || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [scopedIssues]);

  return (
    <div className="flex flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Page Header: Geist display typography with tight letter spacing */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {teamId ? 'Team Issues' : isMyIssues ? 'My Issues' : 'Issues'}
            </h1>
            <span className="font-mono text-xs font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-[5px]">
              {scopedIssues.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {teamId
              ? 'Work owned by this team. Press C to create, / to search, J/K to navigate.'
              : isMyIssues
                ? 'All work items assigned to you. Press C to create, / to search, J/K to navigate.'
                : 'Capture and triage team work before planning selected issues into a cycle. Press C to create, / to search, J/K to navigate.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View switcher */}
          <div className="flex items-center bg-muted/60 rounded-[6px] p-0.5 border border-border">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded-[4px] transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-background text-foreground shadow-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grouped by Status (Linear sticky view)"
            >
              <Layers className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-[4px] transition-colors ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Flat list view"
            >
              <List className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-[4px] transition-colors ${
                viewMode === 'board'
                  ? 'bg-background text-foreground shadow-xs font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Board view"
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>

          <Button size="sm" onClick={() => setIsCreateOpen(true)} className="rounded-[6px] h-8 px-3 text-xs font-medium">
            <Plus data-icon="inline-start" className="size-3.5" />
            <span>New Issue</span>
          </Button>
        </div>
      </div>

      {/* Linear Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5">
          {filterOptions.map((opt) => {
            const isSelected = filterTab === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterTab(opt.id)}
                className={`h-7 px-2.5 text-xs rounded-[6px] font-medium transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <span>{opt.label}</span>
                <span className={`font-mono text-xs ${isSelected ? 'text-background/80' : 'text-muted-foreground'}`}>
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input adhering to DESIGN.md Geist typography */}
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7.5 pl-8 pr-8 text-xs font-sans tracking-tight bg-background/80 rounded-[6px] border-border/70 placeholder:text-muted-foreground placeholder:font-normal"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 rounded"
              title="Clear search"
            >
              &times;
            </button>
          ) : (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-4 select-none items-center rounded border border-border/70 bg-muted/60 px-1 font-mono text-xs font-medium text-muted-foreground">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load issues from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
            <RefreshCw data-icon="inline-start" className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Content: team issue view mirrors Linear split layout. */}
      {!isLoading && !isError && (
        <div className={teamId ? 'grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]' : ''}>
          <div className="min-w-0">
            {viewMode === 'grouped' ? (
              <IssueGroupedListView
                issues={filteredIssues}
                onSelectIssue={handleOpenDetail}
                onCreateWithStatus={(status) => {
                  setCreateStatus(status);
                  setIsCreateOpen(true);
                }}
                focusedIndex={focusedIndex}
                onFocusIndex={setFocusedIndex}
              />
            ) : viewMode === 'list' ? (
              <IssueListView
                issues={filteredIssues}
                onSelectIssue={handleOpenDetail}
                focusedIndex={focusedIndex}
                onFocusIndex={setFocusedIndex}
              />
            ) : (
              <IssueKanbanBoard issues={filteredIssues} onSelectIssue={handleOpenDetail} />
            )}
          </div>
          {teamId && (
            <aside className="h-fit rounded-lg border border-border/80 bg-card p-4 xl:sticky xl:top-5">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span className="text-xs font-semibold text-foreground">Assignees</span>
                <span className="font-mono text-xs text-muted-foreground">Active</span>
              </div>
              <div className="mt-2 divide-y divide-border/50">
                {assigneeCounts.map(([assigneeId, count]) => {
                  const user = users.find((item) => item.id === assigneeId);
                  return (
                    <button key={assigneeId} type="button" className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-xs hover:text-foreground">
                      <span className="truncate text-muted-foreground">{user?.name || (assigneeId === 'unassigned' ? 'No assignee' : 'Unknown user')}</span>
                      <span className="font-mono text-xs text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
                {!assigneeCounts.length && <p className="py-4 text-xs text-muted-foreground">No active issues.</p>}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Create Issue Dialog */}
      <CreateIssueDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setCreateStatus(undefined);
        }}
        defaultTeamId={teamId}
        defaultStatus={createStatus}
      />

      {/* Issue Detail Sheet */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
