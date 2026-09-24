import * as React from 'react';
import { Button, Skeleton } from '@reka/ui';
import { Plus, LayoutGrid, List, RefreshCw } from 'lucide-react';
import { useIssues } from '../hooks/use-issues';
import { CreateIssueDialog } from './create-issue-dialog';
import { IssueDetailSheet } from './issue-detail-sheet';
import { IssueListView } from './issue-list-view';
import { IssueKanbanBoard } from './issue-kanban-board';
import type { Issue } from '@reka/types';

export function IssuesPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'list' | 'board'>('list');
  const [filterTab, setFilterTab] = React.useState('all');

  const { data: issues = [], isLoading, isError, refetch } = useIssues();

  // Linear Keyboard Shortcut: press 'C' to open new issue dialog
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsCreateOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenDetail = (issue: Issue) => {
    setSelectedIssue(issue);
    setIsDetailOpen(true);
  };

  // Filter options with dynamic counts
  const filterOptions = React.useMemo(() => [
    { id: 'all', label: 'All', count: issues.length },
    {
      id: 'active',
      label: 'Active',
      count: issues.filter((i) => i.status !== 'backlog' && i.status !== 'done' && i.status !== 'canceled').length,
    },
    {
      id: 'backlog',
      label: 'Backlog',
      count: issues.filter((i) => i.status === 'backlog').length,
    },
    {
      id: 'done',
      label: 'Done',
      count: issues.filter((i) => i.status === 'done' || i.status === 'canceled').length,
    },
  ], [issues]);

  // Filtered issues based on active button
  const filteredIssues = React.useMemo(() => {
    if (filterTab === 'active') {
      return issues.filter((i) => i.status === 'todo' || i.status === 'in_progress' || i.status === 'in_review');
    }
    if (filterTab === 'backlog') {
      return issues.filter((i) => i.status === 'backlog');
    }
    if (filterTab === 'done') {
      return issues.filter((i) => i.status === 'done' || i.status === 'canceled');
    }
    return issues;
  }, [issues, filterTab]);

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-[-0.4px] text-foreground">Issues</h1>
            <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-[4px]">
              {issues.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage work items. Press <kbd className="font-mono border border-border rounded px-1 py-0.2 bg-muted text-[10px]">C</kbd> anywhere to create.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher: List vs Board */}
          <div className="flex items-center bg-secondary/60 rounded-[6px] p-0.5 border border-border/50">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-[4px] transition-colors ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="List view"
            >
              <List className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-[4px] transition-colors ${
                viewMode === 'board'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Board view"
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>

          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            <span>New Issue</span>
          </Button>
        </div>
      </div>

      {/* Filter Buttons (Linear Style - replaces Tabs) */}
      {viewMode === 'list' && (
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-2">
          {filterOptions.map((opt) => {
            const isSelected = filterTab === opt.id;
            return (
              <Button
                key={opt.id}
                type="button"
                variant={isSelected ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterTab(opt.id)}
                className={`h-7 px-2.5 text-xs rounded-[6px] transition-colors ${
                  isSelected
                    ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                <span>{opt.label}</span>
                <span className="ml-1 text-[11px] font-mono opacity-60">
                  {opt.count}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load issues from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        </div>
      )}

      {/* Content: List or Board */}
      {!isLoading && !isError && (
        viewMode === 'list' ? (
          <IssueListView issues={filteredIssues} onSelectIssue={handleOpenDetail} />
        ) : (
          <IssueKanbanBoard issues={issues} onSelectIssue={handleOpenDetail} />
        )
      )}

      {/* Create Issue Dialog */}
      <CreateIssueDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Issue Detail Sheet */}
      <IssueDetailSheet
        issue={selectedIssue}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
