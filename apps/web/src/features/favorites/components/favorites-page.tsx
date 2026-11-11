import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, Skeleton, Alert, AlertDescription, Spinner } from '@reka/ui';
import { FileText, FolderKanban, RefreshCw, Star, Trash2 } from 'lucide-react';
import { useFavorites, useToggleFavorite } from '../hooks/use-favorites';
import { useAuth } from '../../auth/hooks/use-auth';
import { EmptyState, PageContainer, PageHeader } from '../../../components/common/page';

export function FavoritesPage() {
  const { data: favorites = [], isLoading, isError, refetch } = useFavorites();
  const toggle = useToggleFavorite();
  const user = useAuth().user;
  const canFavorite = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'member';
  return <PageContainer>
    <PageHeader title="Favorites" count={isLoading ? undefined : favorites.length} description="Your saved issues, projects, and documents." />
    {isLoading && <div className="flex flex-col gap-2"><Spinner aria-label="Loading favorites" className="sr-only" />{[1, 2, 3].map(item => <Skeleton key={item} className="h-10 w-full" />)}</div>}
    {isError && <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>Could not load favorites.</span><Button variant="outline" size="sm" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Retry favorites</Button></AlertDescription></Alert>}
    {!isLoading && !isError && (favorites.length ? <ul className="divide-y divide-border border-y border-border">{favorites.map(item => <li key={`${item.resourceType}:${item.resourceId}`} className="flex min-w-0 items-center gap-3 py-2.5">
      <Link to={item.href} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {item.resourceType === 'project' ? <FolderKanban className="size-4 shrink-0 text-muted-foreground" /> : item.resourceType === 'document' ? <FileText className="size-4 shrink-0 text-muted-foreground" /> : <span className="size-4 shrink-0 font-mono text-xs text-muted-foreground">#</span>}
        <span className="truncate">{item.name}</span><span className="shrink-0 text-xs capitalize text-muted-foreground">{item.resourceType}</span>
      </Link>
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${item.name} from favorites`} disabled={!canFavorite || toggle.isPending} onClick={() => toggle.mutate({ resourceType: item.resourceType, resourceId: item.resourceId, favorite: false })}><Trash2 /></Button>
    </li>)}</ul> : <EmptyState icon={Star} title="No favorites yet" description="Star an issue, project or document to keep it here." />)}
  </PageContainer>;
}
