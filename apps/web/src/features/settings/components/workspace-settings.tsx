import * as React from 'react';
import { useForm } from '@tanstack/react-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Badge, Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Field, FieldDescription, FieldError, FieldGroup, FieldLabel, Input, Skeleton, toast } from '@reka/ui';
import { getWorkspace, updateWorkspace, deleteWorkspace, getWorkspaceInvitations, revokeWorkspaceInvitation, WORKSPACE_QUERY_KEY, INVITATIONS_QUERY_KEY } from '../api/workspace.api';
import { InviteUserDialog } from '../../users/components/invite-user-dialog';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { slugify } from '../../../lib/auth-client';

export function WorkspaceSettings() {
  const queryClient = useQueryClient();
  const workspace = useQuery({ queryKey: WORKSPACE_QUERY_KEY, queryFn: getWorkspace });
  const currentWorkspace = workspace.data;
  const canManage = workspace.data?.role === 'owner' || workspace.data?.role === 'admin';
  const invitations = useQuery({ queryKey: INVITATIONS_QUERY_KEY, queryFn: getWorkspaceInvitations, enabled: canManage });
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const form = useForm({
    defaultValues: { name: currentWorkspace?.name ?? '', slug: currentWorkspace?.slug ?? '', logo: currentWorkspace?.logoUrl ?? '' },
    onSubmit: ({ value }) => { update.mutate({ name: value.name.trim(), slug: slugify(value.slug), logo: value.logo.trim() || null }); },
  });
  React.useEffect(() => { form.reset(); }, [currentWorkspace?.name, currentWorkspace?.slug, currentWorkspace?.logoUrl]);
  // The slug is part of /w/<slug> links and the session's workspace, so every cached read is refreshed.
  const update = useMutation({ mutationFn: updateWorkspace, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['auth'] }); await queryClient.invalidateQueries({ queryKey: WORKSPACE_QUERY_KEY }); toast.success('Workspace updated'); } });
  const remove = useMutation({ mutationFn: () => deleteWorkspace(currentWorkspace!.id), onSuccess: () => { queryClient.clear(); window.location.assign('/'); } });
  const revoke = useMutation({ mutationFn: revokeWorkspaceInvitation, onSuccess: () => { queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY }); toast.success('Invitation revoked'); } });
  return (
    <Card id="workspace">
      <CardHeader><CardTitle>Workspace</CardTitle><CardDescription>Name, URL and logo, plus email invitations. Owners and admins manage access.</CardDescription></CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-6">
        {workspace.isLoading && <Skeleton className="h-16 w-full" />}
        {workspace.isError && <Alert variant="destructive"><AlertDescription>Could not load your workspace. <Button variant="outline" size="sm" onClick={() => workspace.refetch()}>Retry workspace</Button></AlertDescription></Alert>}
        {currentWorkspace && (
          <form className="flex flex-col items-start gap-4" onSubmit={event => { event.preventDefault(); event.stopPropagation(); form.handleSubmit(); }}>
            <FieldGroup className="w-full min-w-0 max-w-lg">
              <form.Field name="name" validators={{ onChange: ({ value }) => (!value.trim() ? 'Workspace name is required' : undefined) }}>
                {field => (
                  <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                    <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
                    <Input id="workspace-name" name={field.name} maxLength={255} required value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} readOnly={!canManage} disabled={update.isPending} />
                    {field.state.meta.isTouched && !field.state.meta.isValid && <FieldError errors={field.state.meta.errors.map(message => ({ message: String(message) }))} />}
                  </Field>
                )}
              </form.Field>
              <form.Field name="slug" validators={{ onChange: ({ value }) => (!slugify(value) ? 'Workspace URL is required' : undefined) }}>
                {field => (
                  <Field data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}>
                    <FieldLabel htmlFor="workspace-slug">Workspace URL</FieldLabel>
                    <Input id="workspace-slug" name={field.name} maxLength={48} required value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} readOnly={!canManage} disabled={update.isPending} />
                    <FieldDescription>{window.location.origin}/w/{slugify(field.state.value) || '…'} — changing it breaks old links.</FieldDescription>
                    {field.state.meta.isTouched && !field.state.meta.isValid && <FieldError errors={field.state.meta.errors.map(message => ({ message: String(message) }))} />}
                  </Field>
                )}
              </form.Field>
              <form.Field name="logo">
                {field => (
                  <Field>
                    <FieldLabel htmlFor="workspace-logo">Logo URL</FieldLabel>
                    <Input id="workspace-logo" name={field.name} type="url" placeholder="https://…" value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} readOnly={!canManage} disabled={update.isPending} />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
            {canManage && <form.Subscribe selector={state => [state.isDirty, state.values.name] as const}>{([isDirty, name]) => <Button type="submit" disabled={update.isPending || !isDirty || !name.trim()}>{update.isPending ? 'Saving…' : 'Save workspace'}</Button>}</form.Subscribe>}
          </form>
        )}
        {update.isError && <Alert variant="destructive"><AlertDescription>{update.error.message}</AlertDescription></Alert>}
        {canManage && (
          <section className="flex min-w-0 flex-col gap-4" aria-labelledby="invitations-title">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="invitations-title" className="text-sm font-medium">Workspace invitations</h3><Button size="sm" onClick={() => setInviteOpen(true)}>Invite member</Button></div>
            {invitations.isLoading && <Skeleton className="h-16 w-full" />}
            {invitations.isError && <Alert variant="destructive"><AlertDescription>Could not load invitations. <Button variant="outline" size="sm" onClick={() => invitations.refetch()}>Retry invitations</Button></AlertDescription></Alert>}
            {revoke.isError && <Alert variant="destructive"><AlertDescription>{revoke.error.message}</AlertDescription></Alert>}
            {invitations.data?.length === 0 && <p className="text-sm text-muted-foreground">No invitations yet. Invite a teammate by email.</p>}
            <div className="flex flex-col divide-y divide-border">
              {invitations.data?.map(invitation => {
                const expired = new Date(invitation.expiresAt).getTime() <= Date.now();
                const status = invitation.status === 'accepted' ? 'Accepted' : invitation.status === 'canceled' ? 'Revoked' : invitation.status === 'rejected' ? 'Declined' : expired ? 'Expired' : 'Pending';
                return <div key={invitation.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"><div className="flex min-w-0 flex-1 flex-col gap-1"><span className="break-all text-sm">{invitation.email}</span><span className="text-xs text-muted-foreground">{invitation.role} · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</span></div><Badge variant="outline">{status}</Badge>{status === 'Pending' && <Button variant="outline" size="sm" disabled={revoke.isPending} aria-label={`Revoke invitation for ${invitation.email}`} onClick={() => revoke.mutate(invitation.id)}>{revoke.isPending && revoke.variables === invitation.id ? 'Revoking…' : 'Revoke'}</Button>}</div>;
              })}
            </div>
          </section>
        )}
        {workspace.data?.role === 'owner' && (
          <section className="flex flex-col items-start gap-3 border-t border-border pt-6" aria-labelledby="workspace-danger-title">
            <div><h3 id="workspace-danger-title" className="text-sm font-medium text-destructive">Delete workspace</h3><p className="mt-1 text-sm text-muted-foreground">Removes every team, issue, project and document in {currentWorkspace?.name}. Members keep their accounts.</p></div>
            {remove.isError && <Alert variant="destructive"><AlertDescription>{remove.error.message}</AlertDescription></Alert>}
            <Button variant="destructive" disabled={remove.isPending} onClick={() => setDeleteOpen(true)}>{remove.isPending ? 'Deleting…' : 'Delete workspace'}</Button>
            <ConfirmDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} title={`Delete ${currentWorkspace?.name}?`} description="This cannot be undone. All work in this workspace is permanently deleted." confirmLabel="Delete workspace" onConfirm={() => remove.mutate()} />
          </section>
        )}
      </CardContent>
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </Card>
  );
}
