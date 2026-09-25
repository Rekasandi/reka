import * as React from 'react';
import { Button, Skeleton, Input } from '@reka/ui';
import { Plus, LayoutGrid, List, RefreshCw, Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { useIssues, useUpdateIssue } from '../hooks/use-issues';
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

  // Search & Sorting
  const [searchQuery, setSearchQuery] = React.useState('');
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { data: issues = [], isLoading, isError, refetch } = useIssues();
  const updateMutation = useUpdateIssue();

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

  // Filtered issues by Tab + Search Query
  const filteredIssues = React.useMemo(() => {
    let list = issues;
    if (filterTab === 'active') {
      list = issues.filter((i) => i.status === 'todo' || i.status === 'in_progress' || i.status === 'in_review');
    } else if (filterTab === 'backlog') {
      list = issues.filter((i) => i.status === 'backlog');
    } else if (filterTab === 'done') {
      list = issues.filter((i) => i.status === 'done' || i.status === 'canceled');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.identifier.toLowerCase().includes(q),
      );
    }

    return list;
  }, [issues, filterTab, searchQuery]);

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
      if (!isInput && viewMode === 'list' && filteredIssues.length > 0) {
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

  return (
    <div className="flex flex-col gap-5 max-w-6xl mx-auto selection:bg-foreground selection:text-background">
      {/* Page Header: Geist display typography with tight letter spacing */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">Issues</h1>
            <span className="font-mono text-[11px] font-medium text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {issues.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage work items. Press <kbd className="font-mono border border-border/80 rounded-[4px] px-1 py-0.5 bg-muted/60 text-[10px] text-foreground">C</kbd> to create, <kbd className="font-mono border border-border/80 rounded-[4px] px-1 py-0.5 bg-muted/60 text-[10px] text-foreground">/</kbd> to search, <kbd className="font-mono border border-border/80 rounded-[4px] px-1 py-0.5 bg-muted/60 text-[10px] text-foreground">J</kbd>/<kbd className="font-mono border border-border/80 rounded-[4px] px-1 py-0.5 bg-muted/60 text-[10px] text-foreground">K</kbd> to navigate.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View switcher */}
          <div className="flex items-center bg-secondary/50 rounded-[6px] p-0.5 border border-border/60">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-[4px] transition-colors ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-2xs font-medium'
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
                  ? 'bg-background text-foreground shadow-2xs font-medium'
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
                    ? 'bg-secondary text-foreground shadow-2xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                <span>{opt.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            placeholder="Search issues... (/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7.5 pl-8 pr-7 text-xs bg-background/80 rounded-[6px] border-border/70 font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-[8px]" />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load issues from server.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
            <RefreshCw data-icon="inline-start" className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Content: List or Board */}
      {!isLoading && !isError && (
        viewMode === 'list' ? (
          <IssueListView
            issues={filteredIssues}
            onSelectIssue={handleOpenDetail}
            focusedIndex={focusedIndex}
            onFocusIndex={setFocusedIndex}
          />
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
