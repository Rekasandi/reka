import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, Skeleton } from '@reka/ui';
import { FileText, FolderKanban, RefreshCw, SlidersHorizontal, Star, Trash2 } from 'lucide-react';
import { useFavorites, useToggleFavorite } from '../hooks/use-views';
import { useAuthStore } from '../../../stores/auth.store';

export function FavoritesPage() {
  const { data: favorites = [], isLoading, isError, refetch } = useFavorites();
  const toggle = useToggleFavorite();
  const user = useAuthStore(state => state.user);
  const canFavorite = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'member';
  return <main className="flex flex-col gap-5 pb-10">
    <header className="flex items-center justify-between"><div><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Favorites</h1><p className="mt-1 text-xs text-muted-foreground">Your saved issues, projects, documents and views.</p></div><Star className="size-4 text-amber-500" /></header>
    {isLoading && <div role="status" aria-label="Loading favorites" className="flex flex-col gap-2">{[1, 2, 3].map(item => <Skeleton key={item} className="h-10 w-full" />)}</div>}
    {isError && <div role="alert" className="flex items-center justify-between border border-destructive/30 bg-destructive/5 p-3 text-xs"><span>Favorites could not be loaded.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry</Button></div>}
    {!isLoading && !isError && (favorites.length ? <ul className="divide-y divide-border border-y border-border">{favorites.map(item => <li key={`${item.resourceType}:${item.resourceId}`} className="flex min-w-0 items-center gap-3 py-2.5">
      <Link to={item.href} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {item.resourceType === 'project' ? <FolderKanban className="size-4 shrink-0 text-muted-foreground" /> : item.resourceType === 'view' ? <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" /> : item.resourceType === 'document' ? <FileText className="size-4 shrink-0 text-muted-foreground" /> : <span className="size-4 shrink-0 font-mono text-xs text-muted-foreground">#</span>}
        <span className="truncate">{item.name}</span><span className="shrink-0 text-xs capitalize text-muted-foreground">{item.resourceType}</span>
      </Link>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${item.name} from favorites`} disabled={!canFavorite || toggle.isPending} onClick={() => toggle.mutate({ resourceType: item.resourceType, resourceId: item.resourceId, favorite: false })}><Trash2 /></Button>
    </li>)}</ul> : <div className="border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No favorites yet. Star an issue, project or saved view to keep it here.</div>)}
  </main>;
}
