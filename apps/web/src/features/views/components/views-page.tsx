import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Input, Skeleton } from '@reka/ui';
import { Layers2, LockKeyhole, RefreshCw, Search, Users } from 'lucide-react';
import { useSavedViews } from '../hooks/use-views';

export function ViewsPage() {
  const [params] = useSearchParams();
  const teamId = params.get('teamId') || undefined;
  const { data: views = [], isLoading, isError, refetch } = useSavedViews(teamId);
  const [query, setQuery] = React.useState('');
  const filtered = views.filter(view => view.name.toLowerCase().includes(query.trim().toLowerCase()));
  const issuesHref = teamId ? `/teams/${teamId}/issues` : '/issues';

  return <main className="flex min-w-0 flex-col gap-5 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Views</h1><p className="mt-1 text-xs text-muted-foreground">Saved issue filters and layouts for you and your team.</p></div>
      <Button asChild variant="outline"><Link to={issuesHref}>Open issues</Link></Button>
    </header>
    <div className="relative max-w-sm"><Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search views" placeholder="Search views…" className="pl-9" value={query} onChange={event => setQuery(event.target.value)} /></div>
    {isLoading ? <div role="status" aria-label="Loading views" className="flex flex-col gap-2">{[0, 1, 2].map(index => <Skeleton key={index} className="h-14 w-full" />)}</div>
      : isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 py-6"><p className="text-sm text-muted-foreground">Could not load views.</p><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>
      : filtered.length ? <ul aria-label="Saved views" className="divide-y divide-border border-y border-border">{filtered.map(view => {
        const viewTeamId = teamId || view.teamId;
        const href = viewTeamId ? `/teams/${viewTeamId}/issues` : '/issues';
        const VisibilityIcon = view.visibility === 'private' ? LockKeyhole : Users;
        return <li key={view.id}><Link to={`${href}?viewId=${encodeURIComponent(view.id)}`} className="flex min-w-0 items-center gap-3 rounded-sm px-3 py-4 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Layers2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{view.name}</span>
          <Badge variant="outline" className="shrink-0 capitalize"><VisibilityIcon aria-hidden="true" className="size-3" />{view.visibility}</Badge>
        </Link></li>;
      })}</ul>
      : <div className="flex flex-col items-center gap-2 py-12 text-center"><p className="text-sm font-medium">{query.trim() ? 'No matching views' : 'No saved views yet'}</p><p className="text-xs text-muted-foreground">{query.trim() ? 'Try a different search.' : 'Save a view from Issues to keep its filters and layout here.'}</p></div>}
  </main>;
}
