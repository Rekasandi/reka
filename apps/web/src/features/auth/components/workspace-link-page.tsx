import * as React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Alert, AlertDescription, Button } from '@reka/ui';
import { useAuth } from '../hooks/use-auth';
import { useSwitchWorkspace, useWorkspaces } from '../hooks/use-workspaces';
import { AuthLayout } from './auth-layout';

/**
 * Shareable workspace links, Linear-style: /w/<slug>/issues/ENG-12 opens that page in that workspace,
 * switching the session to it when the signed-in user is a member.
 */
export function WorkspaceLinkPage() {
  const { slug = '', '*': rest = '' } = useParams();
  const { user, isLoading } = useAuth();
  const workspaces = useWorkspaces(!!user);
  const switchWorkspace = useSwitchWorkspace();
  const target = `/${rest}`;
  const match = workspaces.data?.find(workspace => workspace.slug === slug);
  React.useEffect(() => {
    if (match && user?.workspace?.slug !== slug && switchWorkspace.isIdle) switchWorkspace.mutate(match.id, { onSuccess: () => { window.location.assign(target); } });
  }, [match, slug, target, user?.workspace?.slug, switchWorkspace]);
  if (isLoading) return null;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(`/w/${slug}/${rest}`)}`} replace />;
  if (user.workspace?.slug === slug) return <Navigate to={target} replace />;
  if (workspaces.isSuccess && !match) {
    return (
      <AuthLayout title="No access to this workspace" description={<>You are signed in as {user.email}, which is not a member of <strong>{slug}</strong>.</>}>
        <Alert><AlertDescription>Ask a workspace admin to invite you, or sign in with the account that belongs to it.</AlertDescription></Alert>
        <Button asChild variant="outline"><a href="/">Back to my workspace</a></Button>
      </AuthLayout>
    );
  }
  return null;
}
