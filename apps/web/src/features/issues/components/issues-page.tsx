import * as React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button, Skeleton, Input, Badge, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuCheckboxItem, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@reka/ui';
import { Filter, PanelRight, Plus, LayoutGrid, List, RefreshCw, Search, Layers, X, SlidersHorizontal, Star, Trash2, Save, Tag, BarChart2 } from 'lucide-react';
import { useIssues, useIssueLabels } from '../hooks/use-issues';
import { useUsers } from '../../users/hooks/use-users';
import { useProjects } from '../../projects/hooks/use-projects';
import { useAuthStore } from '../../../stores/auth.store';
import { CreateIssueDialog } from './create-issue-dialog';
import { IssueDetailSheet } from './issue-detail-sheet';
import { IssueListView } from './issue-list-view';
import { IssueGroupedListView } from './issue-grouped-list-view';
import { IssueKanbanBoard } from './issue-kanban-board';
import { IssueFiltersSidebar, type FilterCategory } from './issue-filters-sidebar';
import { IssueMetricsAside } from './issue-metrics-aside';
import { ManageLabelsDialog } from './manage-labels-dialog';
import { EMPTY_ISSUE_FILTERS, filterIssues, type IssueFilters } from '../lib/issue-filters';
import { getIssueStatusCategory, isIssueClosed, type Issue } from '@reka/types';
import { useCreateSavedView, useDeleteSavedView, useFavorites, useSavedViews, useToggleFavorite, useUpdateSavedView } from '../../views/hooks/use-views';
import type { SavedView, SavedViewConfig } from '../../views/api/views.api';
import { useTeams } from '../../teams/hooks/use-teams';
import { WorkPageHeader } from '../../../components/common/work-list';

interface IssuesPageProps {
  teamId?: string;
}

export function IssuesPage({ teamId }: IssuesPageProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isMyIssues = location.pathname === '/my-issues';

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grouped' | 'list' | 'board'>('grouped');
  const [groupBy, setGroupBy] = React.useState<'status' | 'none'>('status');
  const [sortBy, setSortBy] = React.useState<'manual' | 'updated' | 'priority' | 'dueDate'>('manual');
  const [selectedViewId, setSelectedViewId] = React.useState('');
  const [saveViewOpen, setSaveViewOpen] = React.useState(false);
  const [viewName, setViewName] = React.useState('');
  const [viewVisibility, setViewVisibility] = React.useState<'private' | 'shared'>('private');
  const appliedViewId = React.useRef('');
  const [createStatus, setCreateStatus] = React.useState<string | undefined>(undefined);
  const [filterTab, setFilterTab] = React.useState('all');
  const [filters, setFilters] = React.useState<IssueFilters>(EMPTY_ISSUE_FILTERS);
  const [filterCategory, setFilterCategory] = React.useState<FilterCategory>('assignees');
  const [filtersVisible, setFiltersVisible] = React.useState(false);
  const [metricsVisible, setMetricsVisible] = React.useState(false);
  const [mobileMetricsOpen, setMobileMetricsOpen] = React.useState(false);
  const [showSubtasks, setShowSubtasks] = React.useState(() => {
    try { return localStorage.getItem('reka:issues:show-subtasks') !== 'false'; }
    catch { return true; }
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [manageLabelsOpen, setManageLabelsOpen] = React.useState(false);

  // Search & Sorting
  const [searchQuery, setSearchQuery] = React.useState('');
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const { data: issues = [], isLoading, isError, refetch } = useIssues(undefined, filterTab === 'archived');
  const { data: users = [] } = useUsers();
  const { data: projects = [] } = useProjects();
  const { data: labels = [], isLoading: labelsLoading } = useIssueLabels();
  const { data: teams = [] } = useTeams();
  const { data: savedViews = [], isLoading: viewsLoading, isError: viewsError, refetch: refetchViews } = useSavedViews(teamId);
  const { data: favorites = [] } = useFavorites();
  const createSavedView = useCreateSavedView();
  const updateSavedView = useUpdateSavedView();
  const deleteSavedView = useDeleteSavedView();
  const toggleFavorite = useToggleFavorite();
  const currentSavedView = savedViews.find(view => view.id === selectedViewId);
  const currentViewFavorite = favorites.some(item => item.resourceType === 'view' && item.resourceId === selectedViewId);
  const canFavorite = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'member';
  const canCreateView = canFavorite && (!teamId || !!teams.find(team => team.id === teamId)?.canWrite);
  const canManageLabels = teamId ? !!teams.find(team => team.id === teamId)?.canManage : teams.some(team => team.canManage);
  const canShareView = teamId ? !!teams.find(team => team.id === teamId)?.canManage : user?.role === 'owner' || user?.role === 'admin';
  const viewConfig: SavedViewConfig = { filterTab: filterTab as SavedViewConfig['filterTab'], viewMode, groupBy, sortBy, showSubtasks, filters };

  const applySavedView = (view: SavedView) => {
    setSelectedViewId(view.id); setFilterTab(view.config.filterTab); setViewMode(view.config.viewMode);
    setGroupBy(view.config.groupBy); setSortBy(view.config.sortBy); setShowSubtasks(view.config.showSubtasks);
    setFilters(view.config.filters);
  };
  React.useEffect(() => {
    const viewId = searchParams.get('viewId');
    if (!viewId) { appliedViewId.current = ''; setSelectedViewId(''); return; }
    const view = savedViews.find(item => item.id === viewId);
    if (view && appliedViewId.current !== view.id) { applySavedView(view); appliedViewId.current = view.id; }
  }, [searchParams, savedViews]);
  React.useEffect(() => {
    if (searchParams.get('create') !== '1') return;
    setIsCreateOpen(true);
    const next = new URLSearchParams(searchParams); next.delete('create'); setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  React.useEffect(() => {
    const issueId = searchParams.get('issueId');
    if (!issueId) return;
    const issue = issues.find(item => item.id === issueId);
    if (issue) { setSelectedIssue(issue); setIsDetailOpen(true); }
  }, [searchParams, issues]);

  const handleShowSubtasksChange = (checked: boolean) => {
    setShowSubtasks(checked);
    try { localStorage.setItem('reka:issues:show-subtasks', String(checked)); } catch { /* Keep this preference for the current page session. */ }
  };

  const handleOpenDetail = (issue: Issue) => {
    setSelectedIssue(issue); setIsDetailOpen(true);
    const next = new URLSearchParams(searchParams); next.set('issueId', issue.id); setSearchParams(next, { replace: true });
  };
  const handleSelectView = (id: string) => {
    if (!id) { appliedViewId.current = ''; setSelectedViewId(''); const next = new URLSearchParams(searchParams); next.delete('viewId'); setSearchParams(next, { replace: true }); return; }
    const view = savedViews.find(item => item.id === id);
    if (view) { applySavedView(view); const next = new URLSearchParams(searchParams); next.set('viewId', id); setSearchParams(next, { replace: true }); }
  };
  const handleSaveView = () => {
    const name = viewName.trim(); if (!name) return;
    createSavedView.mutate({ name, teamId: teamId ?? null, visibility: viewVisibility, config: viewConfig }, { onSuccess: view => {
      applySavedView(view); appliedViewId.current = view.id; const next = new URLSearchParams(searchParams); next.set('viewId', view.id); setSearchParams(next, { replace: true });
      setSaveViewOpen(false); setViewName('');
    } });
  };
  const handleUpdateView = () => {
    if (!currentSavedView?.canEdit) return;
    updateSavedView.mutate({ id: currentSavedView.id, input: { config: viewConfig } });
  };
  const handleRemoveView = () => {
    if (!currentSavedView?.canEdit || !window.confirm(`Delete saved view “${currentSavedView.name}”?`)) return;
    deleteSavedView.mutate(currentSavedView.id, { onSuccess: () => handleSelectView('') });
  };
  const handleToggleViewFavorite = () => {
    if (!selectedViewId) return;
    toggleFavorite.mutate({ resourceType: 'view', resourceId: selectedViewId, favorite: !currentViewFavorite });
  };

  // Scope to my-issues if on that route
  const scopedIssues = React.useMemo(() => {
    if (teamId) return issues.filter((issue) => issue.teamId === teamId);
    if (filterTab === 'archived') return issues;

    if (isMyIssues) {
      if (!user) return issues.filter((issue) => !isIssueClosed(issue));
      const assigned = issues.filter((i) => i.assigneeId === user.id);
      return assigned.length > 0
        ? assigned
        : issues.filter((issue) => ['started', 'unstarted'].includes(getIssueStatusCategory(issue)));
    }
    return issues;
  }, [issues, isMyIssues, teamId, user, filterTab]);

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'done', label: 'Done' },
    { id: 'archived', label: 'Archived' },
  ];

  // Filter by status tab and search first; sidebar facets count this unfiltered base.
  const filterBaseIssues = React.useMemo(() => {
    let list = scopedIssues;
    if (filterTab === 'active') {
      list = scopedIssues.filter((issue) => ['unstarted', 'started'].includes(getIssueStatusCategory(issue)));
    } else if (filterTab === 'backlog') {
      list = scopedIssues.filter((issue) => getIssueStatusCategory(issue) === 'backlog');
    } else if (filterTab === 'done') {
      list = scopedIssues.filter((issue) => ['completed', 'canceled'].includes(getIssueStatusCategory(issue)));
    } else if (filterTab === 'archived') {
      list = scopedIssues;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.identifier.toLowerCase().includes(q),
      );
    }

    return list;
  }, [scopedIssues, filterTab, searchQuery]);

  const filteredIssues = React.useMemo(() => {
    const result = filterIssues(filterBaseIssues, filters);
    if (sortBy === 'updated') return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    if (sortBy === 'priority') {
      const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, no_priority: 4 };
      return result.sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));
    }
    if (sortBy === 'dueDate') return result.sort((a, b) => a.dueDate && b.dueDate ? new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() : a.dueDate ? -1 : b.dueDate ? 1 : 0);
    return result;
  }, [filterBaseIssues, filters, sortBy]);

  const activeFilterCount = filters.assigneeIds.length + filters.labelIds.length + filters.priorities.length + filters.projectIds.length;
  const toggleFilter = (field: keyof IssueFilters, id: string) => {
    setFilters((current) => {
      const selected = current[field];
      return {
        ...current,
        [field]: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
      };
    });
  };

  // Linear Keyboard Shortcuts: 'C' (New), '/' (Search), 'J'/'K' (Navigate), 'Space'/'Enter' (Open)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = !!target.closest('input, textarea, select, [contenteditable="true"], [role="combobox"], [role="dialog"], [role="menu"], [role="menuitem"], button, a');
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // '/' to focus search
      if (!isInput && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
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

  return (
    <div className="flex flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      <WorkPageHeader
        title={teamId ? 'Team Issues' : isMyIssues ? 'My Issues' : 'Issues'}
        count={scopedIssues.length}
        description={teamId ? 'Work owned by this team.' : isMyIssues ? 'Issues assigned to you.' : 'Track and prioritize workspace issues.'}
      >
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="xl:hidden">
                <Filter data-icon="inline-start" />
                Filters
                {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="gap-0 overflow-hidden p-0 data-[side=right]:w-[min(100vw,24rem)]">
              <SheetHeader className="shrink-0 pr-12">
                <SheetTitle>Issue filters</SheetTitle>
                <SheetDescription>Filter by assignee, label, priority, or project.</SheetDescription>
              </SheetHeader>
              <IssueFiltersSidebar
                issues={filterBaseIssues}
                users={users}
                labels={labels}
                labelsLoading={labelsLoading}
                projects={projects}
                filters={filters}
                category={filterCategory}
                onCategoryChange={setFilterCategory}
                onToggle={toggleFilter}
                onClear={() => setFilters(EMPTY_ISSUE_FILTERS)}
              />
            </SheetContent>
          </Sheet>

          {/* View switcher */}
          <div role="group" aria-label="Issue view" className="flex items-center rounded-md border bg-muted/60 p-0.5">
            <Button type="button" variant={viewMode === 'grouped' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setViewMode('grouped')} aria-pressed={viewMode === 'grouped'} title="Grouped by status" aria-label="Grouped by status">
              <Layers />
            </Button>
            <Button type="button" variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setViewMode('list')} aria-pressed={viewMode === 'list'} title="List view" aria-label="List view">
              <List />
            </Button>
            <Button type="button" variant={viewMode === 'board' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => { if (groupBy === 'none') setGroupBy('status'); setViewMode('board'); }} aria-pressed={viewMode === 'board'} title="Board view" aria-label="Board view">
              <LayoutGrid />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Customize view" title="Customize view"><SlidersHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Customize view</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={showSubtasks} onCheckedChange={handleShowSubtasksChange}>Show sub-issues</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canManageLabels && <Button type="button" variant="outline" onClick={() => setManageLabelsOpen(true)}><Tag data-icon="inline-start" /><span>Manage labels</span></Button>}
          <Button onClick={() => setIsCreateOpen(true)} className="px-3">
            <Plus data-icon="inline-start" />
            <span>New Issue</span>
          </Button>
      </WorkPageHeader>

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-3 py-2" role="group" aria-label="Saved view and display options">
        <label className="sr-only" htmlFor="saved-issue-view">Saved view</label>
        <select id="saved-issue-view" aria-label="Saved issue view" value={selectedViewId} onChange={event => handleSelectView(event.target.value)} disabled={viewsLoading} className="h-8 max-w-56 rounded-md border border-input bg-background px-2 text-xs">
          <option value="">Current filters</option>{savedViews.map(view => <option key={view.id} value={view.id}>{view.name} · {view.visibility}</option>)}
        </select>
        {viewsError && <Button type="button" size="sm" variant="ghost" onClick={() => void refetchViews()}>Retry views</Button>}
        {canCreateView && <Button type="button" size="sm" variant="outline" onClick={() => { setViewName(''); setViewVisibility('private'); setSaveViewOpen(true); }}><Save data-icon="inline-start" />Save view</Button>}
        {currentSavedView?.canEdit && <Button type="button" size="sm" variant="outline" onClick={handleUpdateView} disabled={updateSavedView.isPending}>Save changes</Button>}
        {currentSavedView?.canEdit && <Button type="button" size="icon-sm" variant="ghost" aria-label="Delete saved view" title="Delete saved view" onClick={handleRemoveView}><Trash2 /></Button>}
        <Button type="button" size="icon-sm" variant="ghost" aria-label={currentViewFavorite ? 'Remove view from favorites' : 'Add view to favorites'} title={selectedViewId ? 'Toggle favorite view' : 'Select a saved view to favorite'} disabled={!canFavorite || !selectedViewId || toggleFavorite.isPending} onClick={handleToggleViewFavorite}><Star className={currentViewFavorite ? 'fill-current text-amber-500' : ''} /></Button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Group<select aria-label="Group issues by" value={groupBy} onChange={event => { const next = event.target.value as 'status' | 'none'; setGroupBy(next); if (next === 'none' && viewMode === 'board') setViewMode('list'); }} className="h-8 rounded-md border border-input bg-background px-2 text-foreground"><option value="status">Status</option><option value="none">None</option></select></label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Sort<select aria-label="Sort issues by" value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} className="h-8 rounded-md border border-input bg-background px-2 text-foreground"><option value="manual">Manual order</option><option value="updated">Recently updated</option><option value="priority">Priority</option><option value="dueDate">Due date</option></select></label>
        <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Save issue view</DialogTitle><DialogDescription>Save these filters, sorting and layout to your workspace account.</DialogDescription></DialogHeader>
          <label className="flex flex-col gap-1.5 text-xs font-medium">View name<Input autoFocus maxLength={80} value={viewName} onChange={event => setViewName(event.target.value)} placeholder="e.g. High priority bugs" /></label>
          <label className="flex flex-col gap-1.5 text-xs font-medium">Visibility<select aria-label="View visibility" value={viewVisibility} onChange={event => setViewVisibility(event.target.value as 'private' | 'shared')} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="private">Only me</option><option value="shared" disabled={!canShareView}>Shared with {teamId ? 'team' : 'workspace'}</option></select></label>
          {!canShareView && <p className="text-xs text-muted-foreground">Only team leads or workspace admins can publish shared views.</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setSaveViewOpen(false)}>Cancel</Button><Button type="button" onClick={handleSaveView} disabled={!viewName.trim() || createSavedView.isPending}>Save view</Button></DialogFooter>
        </DialogContent></Dialog>
      </div>

      {/* Linear Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5">
          {filterOptions.map((opt) => {
            const isSelected = filterTab === opt.id;
            return (
              <Button
                key={opt.id}
                type="button"
                variant="category"
                size="sm"
                onClick={() => setFilterTab(opt.id)}
                aria-pressed={isSelected}

              >
                <span>{opt.label}</span>
              </Button>
            );
          })}
        </div>

        {/* Search and filter sheet trigger */}
        <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            aria-label="Search issues"
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7.5 pl-8 pr-8 text-xs font-sans tracking-tight bg-background/80 rounded-[6px] border-border/70 placeholder:text-muted-foreground placeholder:font-normal"
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2"
              title="Clear search"
              aria-label="Clear search"
            >
              <X />
            </Button>
          ) : (
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-4 select-none items-center rounded border border-border/70 bg-muted/60 px-1 font-mono text-xs font-medium text-muted-foreground">
              /
            </kbd>
          )}
        </div>
        <Button
          variant={filtersVisible ? 'secondary' : 'outline'}
          size="sm"
          className="hidden shrink-0 xl:inline-flex"
          aria-expanded={filtersVisible}
          aria-controls="issue-filters-panel"
          onClick={() => {
            setFiltersVisible((visible) => !visible);
            if (!filtersVisible) setMetricsVisible(false);
          }}
        >
          <PanelRight data-icon="inline-start" />
          {filtersVisible ? 'Hide filters' : 'Show filters'}
        </Button>
        <Button
          variant={metricsVisible ? 'secondary' : 'outline'}
          size="sm"
          className="hidden shrink-0 xl:inline-flex"
          aria-expanded={metricsVisible}
          aria-controls="issue-metrics-panel"
          aria-label="Toggle metrics insight"
          title="Toggle metrics insight"
          onClick={() => {
            setMetricsVisible((visible) => !visible);
            if (!metricsVisible) setFiltersVisible(false);
          }}
        >
          <BarChart2 data-icon="inline-start" />
          <span>Insights</span>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="xl:hidden shrink-0"
          aria-label="Issue metrics"
          title="Issue metrics"
          onClick={() => setMobileMetricsOpen(true)}
        >
          <BarChart2 />
        </Button>
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
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        </div>
      )}

      {/* Issue list */}
      {!isLoading && !isError && (
        <div className={(filtersVisible || metricsVisible) ? 'grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]' : 'min-w-0'}>
          <div className="min-w-0">
            {viewMode === 'grouped' && groupBy === 'status' ? (
              <IssueGroupedListView
                issues={filteredIssues}
                onSelectIssue={handleOpenDetail}
                onCreateWithStatus={(status) => {
                  setCreateStatus(status);
                  setIsCreateOpen(true);
                }}
                focusedIndex={focusedIndex}
                onFocusIndex={setFocusedIndex}
                showSubtasks={showSubtasks}
              />
            ) : viewMode === 'list' || groupBy === 'none' ? (
              <IssueListView
                issues={filteredIssues}
                onSelectIssue={handleOpenDetail}
                focusedIndex={focusedIndex}
                onFocusIndex={setFocusedIndex}
                showSubtasks={showSubtasks}
              />
            ) : (
              <IssueKanbanBoard issues={showSubtasks ? filteredIssues : filteredIssues.filter((issue) => !issue.parentId)} onSelectIssue={handleOpenDetail} />
            )}
          </div>
          {filtersVisible && (
            <aside id="issue-filters-panel" aria-label="Issue filters panel" className="sticky top-6 hidden h-[calc(100svh-7.25rem)] min-h-0 self-start flex-col overflow-hidden rounded-xl border border-border bg-card xl:flex">
              <IssueFiltersSidebar
                issues={filterBaseIssues}
                users={users}
                labels={labels}
                labelsLoading={labelsLoading}
                projects={projects}
                filters={filters}
                category={filterCategory}
                onCategoryChange={setFilterCategory}
                onToggle={toggleFilter}
                onClear={() => setFilters(EMPTY_ISSUE_FILTERS)}
              />
            </aside>
          )}
          {metricsVisible && (
            <aside id="issue-metrics-panel" aria-label="Issue metrics insight" className="sticky top-6 hidden h-[calc(100svh-7.25rem)] min-h-0 self-start flex-col overflow-hidden rounded-xl border border-border bg-card xl:flex shadow-sm">
              <IssueMetricsAside
                issues={filteredIssues}
                users={users}
                projects={projects}
                onClose={() => setMetricsVisible(false)}
              />
            </aside>
          )}
        </div>
      )}

      {/* Mobile metrics sheet */}
      <Sheet open={mobileMetricsOpen} onOpenChange={setMobileMetricsOpen}>
        <SheetContent side="right" showCloseButton={false} className="gap-0 overflow-hidden p-0 bg-card text-foreground data-[side=right]:w-[min(100vw,26rem)]">
          <SheetHeader className="sr-only">
            <SheetTitle>Issue metrics</SheetTitle>
            <SheetDescription>Metrics breakdown by status and priority</SheetDescription>
          </SheetHeader>
          <IssueMetricsAside
            issues={filteredIssues}
            users={users}
            projects={projects}
            onClose={() => setMobileMetricsOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <ManageLabelsDialog open={manageLabelsOpen} onOpenChange={setManageLabelsOpen} initialTeamId={teamId} />

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
        issue={selectedIssue ? issues.find((candidate) => candidate.id === selectedIssue.id) ?? selectedIssue : null}
        open={isDetailOpen}
        isFavorite={selectedIssue ? favorites.some(item => item.resourceType === 'issue' && item.resourceId === selectedIssue.id) : false}
        canFavorite={canFavorite}
        onToggleFavorite={() => { if (selectedIssue) toggleFavorite.mutate({ resourceType: 'issue', resourceId: selectedIssue.id, favorite: !favorites.some(item => item.resourceType === 'issue' && item.resourceId === selectedIssue.id) }); }}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open && searchParams.has('issueId')) { const next = new URLSearchParams(searchParams); next.delete('issueId'); setSearchParams(next, { replace: true }); }
        }}
      />
    </div>
  );
}
