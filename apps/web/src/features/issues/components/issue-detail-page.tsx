import * as React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle, Button, Skeleton } from '@reka/ui';
import { ArrowLeft } from 'lucide-react';
import { useIssue } from '../hooks/use-issues';
import { useFavorites, useToggleFavorite } from '../../views/hooks/use-views';
import { useAuthStore } from '../../../stores/auth.store';
import { IssueDetailContent } from './issue-detail-sheet';

export function IssueDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useIssue(id);
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const user = useAuthStore(state => state.user);
  const returnTo = location.state?.returnTo as string | undefined;
  const close = () => {
    const target = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? new URL(returnTo, window.location.origin) : null;
    if (target?.pathname !== '/triage') target?.searchParams.delete('issueId');
    navigate(target ? target.pathname + target.search : '/issues');
  };
  React.useEffect(() => {
    const previous = document.title;
    if (query.data) document.title = `${query.data.identifier}: ${query.data.title} | REKA`;
    return () => { document.title = previous; };
  }, [query.data?.identifier, query.data?.title]);

  if (query.isPending) return <div role="status" aria-label="Loading issue" className="mx-auto flex max-w-6xl flex-col gap-6 py-8"><Skeleton className="h-6 w-24" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-40 w-full" /></div>;
  if (query.isError || !query.data) return <div className="mx-auto flex max-w-xl flex-col gap-4 py-12">
    <Button variant="ghost" className="w-fit" onClick={close}><ArrowLeft data-icon="inline-start" />Back to issues</Button>
    <Alert><AlertTitle>Issue unavailable</AlertTitle><AlertDescription>This issue may have been removed, or you may not have access. Check your connection and try again.</AlertDescription></Alert>
    <Button variant="outline" className="w-fit" onClick={() => void query.refetch()}>Try again</Button>
  </div>;
  const issue = query.data;
  const isFavorite = favorites.data?.some(item => item.resourceType === 'issue' && item.resourceId === issue.id) ?? false;
  return <IssueDetailContent key={issue.id} issue={issue} presentation="page" onClose={close}
    isFavorite={isFavorite} canFavorite={!!user && !['guest', 'client'].includes(user.role) && favorites.isSuccess && !toggle.isPending}
    onToggleFavorite={() => toggle.mutate({ resourceType: 'issue', resourceId: issue.id, favorite: !isFavorite })} />;
}
