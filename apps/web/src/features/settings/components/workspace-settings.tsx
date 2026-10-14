import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Field, FieldGroup, FieldLabel, Input, Skeleton, toast } from '@reka/ui';
import { getWorkspace, updateWorkspace, getWorkspaceInvitations, revokeWorkspaceInvitation, WORKSPACE_QUERY_KEY, INVITATIONS_QUERY_KEY } from '../api/workspace.api';
import { InviteUserDialog } from '../../users/components/invite-user-dialog';

export function WorkspaceSettings() {
  const queryClient = useQueryClient();
  const workspace = useQuery({ queryKey: WORKSPACE_QUERY_KEY, queryFn: getWorkspace });
  const currentWorkspace = workspace.data;
  const canManage = workspace.data?.role === 'owner' || workspace.data?.role === 'admin';
  const invitations = useQuery({ queryKey: INVITATIONS_QUERY_KEY, queryFn: getWorkspaceInvitations, enabled: canManage });
  const [name, setName] = React.useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const update = useMutation({ mutationFn: updateWorkspace, onSuccess: () => { queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY }); setName(null); toast.success('Workspace updated'); } });
  const revoke = useMutation({ mutationFn: revokeWorkspaceInvitation, onSuccess: () => { queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY }); toast.success('Invitation revoked'); } });
  return (
    <Card id="workspace">
      <CardHeader><CardTitle>Workspace</CardTitle><CardDescription>Company settings and GitHub-bound invitations. Owners and admins manage access.</CardDescription></CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-6">
        {workspace.isLoading && <Skeleton className="h-16 w-full" />}
        {workspace.isError && <Alert variant="destructive"><AlertDescription>Could not load your workspace. <Button variant="outline" size="sm" onClick={() => workspace.refetch()}>Retry workspace</Button></AlertDescription></Alert>}
        {currentWorkspace && (
          <form className="flex flex-col items-start gap-3 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); update.mutate((name ?? currentWorkspace.name).trim()); }}>
            <FieldGroup className="w-full min-w-0 sm:flex-1"><Field><FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel><Input id="workspace-name" maxLength={255} required value={name ?? currentWorkspace.name} onChange={event => setName(event.target.value)} readOnly={!canManage} disabled={update.isPending} /></Field></FieldGroup>
            {canManage && <Button type="submit" disabled={update.isPending || name === null || !name.trim()}>{update.isPending ? 'Saving…' : 'Save workspace'}</Button>}
          </form>
        )}
        {update.isError && <Alert variant="destructive"><AlertDescription>{update.error.message}</AlertDescription></Alert>}
        {canManage && (
          <section className="flex min-w-0 flex-col gap-4" aria-labelledby="invitations-title">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="invitations-title" className="text-sm font-medium">Workspace invitations</h3><Button size="sm" onClick={() => setInviteOpen(true)}>Invite User</Button></div>
            {invitations.isLoading && <Skeleton className="h-16 w-full" />}
            {invitations.isError && <Alert variant="destructive"><AlertDescription>Could not load invitations. <Button variant="outline" size="sm" onClick={() => invitations.refetch()}>Retry invitations</Button></AlertDescription></Alert>}
            {revoke.isError && <Alert variant="destructive"><AlertDescription>{revoke.error.message}</AlertDescription></Alert>}
            {invitations.data?.length === 0 && <p className="text-sm text-muted-foreground">No invitations yet. Create a link and share it directly with a teammate.</p>}
            <div className="flex flex-col divide-y divide-border">
              {invitations.data?.map(invitation => {
                const expired = new Date(invitation.expiresAt).getTime() <= Date.now();
                const status = invitation.acceptedAt ? 'Accepted' : invitation.revokedAt ? 'Revoked' : expired ? 'Expired' : 'Pending';
                return <div key={invitation.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"><div className="flex min-w-0 flex-1 flex-col gap-1"><span className="break-all text-sm">{invitation.email}</span><span className="text-xs text-muted-foreground">{invitation.role} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span></div><Badge variant="outline">{status}</Badge>{status === 'Pending' && <Button variant="outline" size="sm" disabled={revoke.isPending} aria-label={`Revoke invitation for ${invitation.email}`} onClick={() => revoke.mutate(invitation.id)}>{revoke.isPending && revoke.variables === invitation.id ? 'Revoking…' : 'Revoke'}</Button>}</div>;
              })}
            </div>
          </section>
        )}
      </CardContent>
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </Card>
  );
}
