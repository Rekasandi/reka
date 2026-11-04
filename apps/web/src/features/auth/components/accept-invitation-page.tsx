import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Skeleton } from '@reka/ui';
import { authClient, authErrorMessage } from '../../../lib/auth-client';
import { useAuth, useLogout } from '../hooks/use-auth';
import { useAcceptInvitation } from '../hooks/use-workspaces';
import { AuthLayout } from './auth-layout';

/** Landing page of an invitation email: sign in (or up) with the invited email, then join. */
export function AcceptInvitationPage() {
  const { id = '' } = useParams();
  const { user, isLoading } = useAuth();
  const logout = useLogout();
  const accept = useAcceptInvitation();
  const invitation = useQuery({
    queryKey: ['auth', 'invitation', id], enabled: !!user && !!id,
    queryFn: async () => { const result = await authClient.organization.getInvitation({ query: { id } }); if (result.error) throw new Error(authErrorMessage(result.error, 'This invitation is invalid or has expired.')); return result.data; },
  });
  if (isLoading) return null;
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(`/accept-invitation/${id}`)}`} replace />;
  const wrongEmail = invitation.data && invitation.data.email.toLowerCase() !== user.email.toLowerCase();
  return (
    <AuthLayout title="Join workspace" description={invitation.data ? `${invitation.data.inviterEmail} invited you to ${invitation.data.organizationName}.` : undefined}
      footer={<span>Signed in as {user.email}. <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => logout.mutate()}>Use another account</Button></span>}>
      {invitation.isLoading && <Skeleton className="h-16 w-full" />}
      {invitation.isError && <Alert variant="destructive" role="alert"><AlertDescription>{invitation.error.message}</AlertDescription></Alert>}
      {wrongEmail && <Alert variant="destructive" role="alert"><AlertDescription>This invitation was sent to <strong>{invitation.data?.email}</strong>. Sign in with that email to accept it.</AlertDescription></Alert>}
      {accept.isError && <Alert variant="destructive" role="alert"><AlertDescription>{accept.error.message}</AlertDescription></Alert>}
      {invitation.data && !wrongEmail && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">You will join <strong>{invitation.data.organizationName}</strong> as <strong>{invitation.data.role}</strong>.</p>
          <Button disabled={accept.isPending || invitation.data.status !== 'pending'} onClick={() => accept.mutate(id)}>{accept.isPending ? 'Joining…' : invitation.data.status === 'pending' ? 'Accept invitation' : `Invitation ${invitation.data.status}`}</Button>
        </div>
      )}
    </AuthLayout>
  );
}
