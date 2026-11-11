import * as React from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { SelectField } from '../../../components/common/select-field';
import { Button, Skeleton, Input, Badge, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, Label, ToggleGroup, ToggleGroupItem, Popover, PopoverTrigger, PopoverContent, Separator, Switch } from '@reka/ui';
import { Filter, PanelRight, Plus, LayoutGrid, List, RefreshCw, Search, Layers, X, SlidersHorizontal, Tag, BarChart2 } from 'lucide-react';
import { useIssues, useIssueLabels } from '../hooks/use-issues';
import { useUsers } from '../../users/hooks/use-users';
import { useProjects } from '../../projects/hooks/use-projects';
import { useAuth } from '../../auth/hooks/use-auth';
import { CreateIssueDialog } from './create-issue-dialog';
import { IssueDetailSheet } from './issue-detail-sheet';
import { IssueListView } from './issue-list-view';
import { IssueGroupedListView } from './issue-grouped-list-view';
import { IssueKanbanBoard } from './issue-kanban-board';
import { IssueFiltersSidebar, type FilterCategory } from './issue-filters-sidebar';
import { IssueMetricsAside } from './issue-metrics-aside';
import { useFavorites, useToggleFavorite } from '../../favorites/hooks/use-favorites';
import { ManageLabelsDialog } from './manage-labels-dialog';
import { EMPTY_ISSUE_FILTERS, filterIssues, type IssueFilters } from '../lib/issue-filters';
import { getIssueStatusCategory, isIssueClosed, type Issue } from '@reka/types';
import { useTeams } from '../../teams/hooks/use-teams';
import { WorkPageHeader } from '../../../components/common/work-list';

interface IssuesPageProps {
  teamId?: string;
}

export function IssuesPage({ teamId }: IssuesPageProps) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isMyIssues = location.pathname === '/my-issues';

  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedIssue, setSelectedIssue] = React.useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grouped' | 'list' | 'board'>('grouped');
  const [groupBy, setGroupBy] = React.useState<'status' | 'none'>('status');
  const [sortBy, setSortBy] = React.useState<'manual' | 'updated' | 'priority' | 'dueDate' | 'sla'>('manual');
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
  const { data: favorites = [] } = useFavorites();
  const toggleFavorite = useToggleFavorite();
  const canFavorite = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'member';
  const canManageLabels = teamId ? !!teams.find(team => team.id === teamId)?.canManage : teams.some(team => team.canManage);

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
    // Soonest SLA deadline first (breached ones lead); issues without an SLA go last.
    if (sortBy === 'sla') {
      const deadline = (issue: Issue) => issue.slaBreachesAt ? new Date(issue.slaBreachesAt).getTime() : Number.MAX_SAFE_INTEGER;
      return result.sort((a, b) => deadline(a) - deadline(b));
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
          <ToggleGroup type="single" variant="outline" aria-label="Issue view" value={viewMode} onValueChange={(next) => {
            if (!next) return;
            if (next === 'board' && groupBy === 'none') setGroupBy('status');
            setViewMode(next as typeof viewMode);
          }} className="rounded-md bg-muted/60 p-0.5">
            <ToggleGroupItem value="grouped" size="icon-sm" title="Grouped by status" aria-label="Grouped by status"><Layers /></ToggleGroupItem>
            <ToggleGroupItem value="list" size="icon-sm" title="List view" aria-label="List view"><List /></ToggleGroupItem>
            <ToggleGroupItem value="board" size="icon-sm" title="Board view" aria-label="Board view"><LayoutGrid /></ToggleGroupItem>
          </ToggleGroup>

          {/* Display options popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                aria-label="Display options"
              >
                <SlidersHorizontal className="size-3.5" />
                <span>Display</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-semibold text-foreground">Display options</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="display-group-by" className="text-xs text-muted-foreground font-normal">
                    Group by
                  </Label>
                  <SelectField
                    id="display-group-by"
                    aria-label="Group issues by"
                    value={groupBy}
                    onValueChange={(value) => {
                      const next = value as 'status' | 'none';
                      setGroupBy(next);
                      if (next === 'none' && viewMode === 'board') setViewMode('list');
                    }}
                    options={[
                      { value: 'status', label: 'Status' },
                      { value: 'none', label: 'None' },
                    ]}
                    className="w-36 h-7.5 text-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="display-sort-by" className="text-xs text-muted-foreground font-normal">
                    Ordering
                  </Label>
                  <SelectField
                    id="display-sort-by"
                    aria-label="Sort issues by"
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as typeof sortBy)}
                    options={[
                      { value: 'manual', label: 'Manual order' },
                      { value: 'updated', label: 'Recently updated' },
                      { value: 'priority', label: 'Priority' },
                      { value: 'dueDate', label: 'Due date' },
                      { value: 'sla', label: 'SLA (soonest first)' },
                    ]}
                    className="w-36 h-7.5 text-xs"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <Label htmlFor="show-subtasks" className="text-xs font-normal text-foreground cursor-pointer">
                  Show sub-issues
                </Label>
                <Switch
                  id="show-subtasks"
                  checked={showSubtasks}
                  onCheckedChange={handleShowSubtasksChange}
                />
              </div>
            </PopoverContent>
          </Popover>

          {canManageLabels && <Button type="button" variant="outline" onClick={() => setManageLabelsOpen(true)}><Tag data-icon="inline-start" /><span>Manage labels</span></Button>}
          <Button onClick={() => setIsCreateOpen(true)} className="px-3">
            <Plus data-icon="inline-start" />
            <span>New issue</span>
          </Button>
      </WorkPageHeader>

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
            placeholder="Search issues…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7.5 pl-8 pr-8 text-xs font-sans tracking-tight bg-background/80 rounded-sm border-border/70 placeholder:text-muted-foreground placeholder:font-normal"
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
            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-4 select-none items-center rounded-sm border border-border/70 bg-muted/60 px-1 font-mono text-xs font-medium text-muted-foreground">
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
            <aside id="issue-filters-panel" aria-label="Issue filters panel" className="sticky top-6 hidden h-[calc(100svh-7.25rem)] min-h-0 self-start flex-col overflow-hidden rounded-lg border border-border bg-card xl:flex">
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
            <aside id="issue-metrics-panel" aria-label="Issue metrics insight" className="sticky top-6 hidden h-[calc(100svh-7.25rem)] min-h-0 self-start flex-col overflow-hidden rounded-lg border border-border bg-card xl:flex shadow-sm">
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
