import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup,
  CommandItem, CommandShortcut, CommandSeparator,
} from '@reka/ui';
import { useUiStore } from '../../stores/ui.store';
import { searchWorkspace, type SearchResults } from '../../features/views/api/views.api';
import {
  CheckSquare, FolderKanban, FileText, Flag, CalendarDays, RotateCcw, Users, Building2, Settings,
  PlusCircle, Inbox, Star, Search, ClipboardList, RefreshCw, LayoutDashboard, UserCheck, Activity,
} from 'lucide-react';

export function CommandPalette() {
  const isOpen = useUiStore(state => state.isCommandPaletteOpen);
  const setOpen = useUiStore(state => state.setCommandPaletteOpen);
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [allResults, setAllResults] = React.useState<SearchResults | null>(null);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => window.clearTimeout(timer);
  }, [query]);
  React.useEffect(() => { setOffset(0); setAllResults(null); }, [debouncedQuery]);
  React.useEffect(() => { if (!isOpen) { setQuery(''); setOffset(0); setAllResults(null); } }, [isOpen]);
  const results = useQuery({ queryKey: ['global-search', debouncedQuery, offset], queryFn: () => searchWorkspace(debouncedQuery, offset), enabled: isOpen && debouncedQuery.length >= 2 });
  React.useEffect(() => {
    if (!results.data) return;
    setAllResults(current => offset === 0 || !current ? results.data! : {
      issues: [...current.issues, ...results.data.issues], projects: [...current.projects, ...results.data.projects],
      documents: [...(current.documents ?? []), ...(results.data.documents ?? [])], hasMore: results.data.hasMore,
    });
  }, [results.data, offset]);
  const displayResults = allResults ?? results.data;

  const handleSelect = (callback: () => void) => { setOpen(false); callback(); };
  const openIssue = (id: string) => handleSelect(() => navigate(`/issues/${encodeURIComponent(id)}`));
  return (
    <CommandDialog open={isOpen} onOpenChange={setOpen}>
      <CommandInput placeholder="Search issues, projects, and documents…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{query.trim().length < 2 ? 'Type at least 2 characters to search.' : results.isLoading ? 'Searching…' : results.isError ? 'Search failed. Retry below.' : 'No matching issues, projects, or documents.'}</CommandEmpty>
        {query.trim().length >= 2 && <>
          {results.isError && <CommandGroup heading="Search"><CommandItem value={query} onSelect={() => void results.refetch()}><RefreshCw /><span>Retry search</span></CommandItem></CommandGroup>}
          {displayResults?.issues.length ? <CommandGroup heading="Issues">{displayResults.issues.map(issue => <CommandItem key={issue.id} value={`${issue.identifier} ${issue.title}`} onSelect={() => openIssue(issue.id)}><Search /><span className="truncate"><span className="mr-2 font-mono text-muted-foreground">{issue.identifier}</span>{issue.title}</span></CommandItem>)}</CommandGroup> : null}
          {displayResults?.projects.length ? <CommandGroup heading="Projects">{displayResults.projects.map(project => <CommandItem key={project.id} value={project.name} onSelect={() => handleSelect(() => navigate(`/projects/${project.id}`))}><FolderKanban /><span>{project.name}</span></CommandItem>)}</CommandGroup> : null}
          {displayResults?.documents?.length ? <CommandGroup heading="Documents">{displayResults.documents.map(document => <CommandItem key={document.id} value={document.title} onSelect={() => handleSelect(() => navigate(`/documents/${document.id}`))}><FileText /><span className="truncate">{document.title}</span></CommandItem>)}</CommandGroup> : null}
          {displayResults?.hasMore && <CommandGroup heading="Search"><CommandItem value={`More results ${debouncedQuery}`} onSelect={() => setOffset(value => value + 10)}><Search /><span>Load more results</span></CommandItem></CommandGroup>}
        </>}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => handleSelect(() => navigate('/issues?create=1'))}><PlusCircle /><span>Create new issue</span><CommandShortcut>C</CommandShortcut></CommandItem>
        </CommandGroup>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelect(() => navigate('/dashboard'))}><LayoutDashboard /><span>Go to Dashboard</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/issues'))}><CheckSquare /><span>Go to All Issues</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/inbox'))}><Inbox /><span>Go to Inbox</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/my-issues'))}><CheckSquare /><span>Go to My Issues</span><CommandShortcut>G I</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/projects'))}><FolderKanban /><span>Go to Projects</span><CommandShortcut>G P</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/initiatives'))}><Flag /><span>Go to Initiatives</span><CommandShortcut>G N</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/roadmap'))}><CalendarDays /><span>Go to Roadmap</span><CommandShortcut>G R</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/documents'))}><FileText /><span>Go to Documents</span><CommandShortcut>G D</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/cycles'))}><RotateCcw /><span>Go to Cycles</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/triage'))}><ClipboardList /><span>Go to Triage</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/favorites'))}><Star /><span>Go to Favorites</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/insights'))}><Activity /><span>Go to Insights</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/users'))}><UserCheck /><span>Go to Users</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/teams'))}><Users /><span>Go to Teams</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/clients'))}><Building2 /><span>Go to Clients</span></CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate('/settings'))}><Settings /><span>Go to Settings</span><CommandShortcut>G S</CommandShortcut></CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
