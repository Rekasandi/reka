import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, Button, Field, FieldDescription, FieldGroup, FieldLabel, Input, Skeleton } from '@reka/ui';
import { useAuth, useLogout } from '../hooks/use-auth';
import { useAcceptInvitation, useCreateWorkspace, useMyInvitations } from '../hooks/use-workspaces';
import { slugify } from '../../../lib/auth-client';
import { AuthLayout } from './auth-layout';

/** First screen after sign-up (and whenever a session has no workspace): join a pending invitation or create a workspace. */
export function OnboardingPage() {
  const { user } = useAuth();
  const logout = useLogout();
  const [searchParams] = useSearchParams();
  const creating = searchParams.get('create') === '1' || !!user?.workspace;
  const invitations = useMyInvitations(!!user);
  const accept = useAcceptInvitation();
  const create = useCreateWorkspace();
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const pending = (invitations.data ?? []).filter(invitation => invitation.status === 'pending' && new Date(invitation.expiresAt).getTime() > Date.now());
  const effectiveSlug = slugTouched ? slug : slugify(name);

  return (
    <AuthLayout wide title={user?.workspace ? 'Create another workspace' : `Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
      description={user?.workspace ? 'Workspaces keep teams, issues and projects separate. You can switch between them any time.' : 'Join the workspace that invited you, or start a new one for your team.'}
      footer={<span>Signed in as {user?.email}. <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => logout.mutate()}>Sign out</Button></span>}>
      {!creating && (
        <section aria-labelledby="pending-invitations" className="flex flex-col gap-3">
          <h2 id="pending-invitations" className="text-sm font-medium">Invitations</h2>
          {invitations.isLoading && <Skeleton className="h-14 w-full" />}
          {invitations.isError && <Alert variant="destructive"><AlertDescription>Could not load invitations. <Button variant="outline" size="sm" onClick={() => invitations.refetch()}>Retry</Button></AlertDescription></Alert>}
          {invitations.isSuccess && pending.length === 0 && <p className="text-sm text-muted-foreground">No pending invitations for {user?.email}. Ask a workspace admin to invite you, or create your own workspace below.</p>}
          {pending.map(invitation => (
            <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{invitation.organizationName ?? 'Workspace'}</p><p className="text-xs text-muted-foreground">Join as {invitation.role}</p></div>
              <Button size="sm" disabled={accept.isPending} onClick={() => accept.mutate(invitation.id)}>{accept.isPending ? 'Joining…' : 'Join'}</Button>
            </div>
          ))}
          {accept.isError && <Alert variant="destructive" role="alert"><AlertDescription>{accept.error.message}</AlertDescription></Alert>}
        </section>
      )}
      <form className="flex flex-col gap-4" aria-labelledby="create-workspace" onSubmit={event => { event.preventDefault(); create.mutate({ name: name.trim(), slug: effectiveSlug }); }}>
        <h2 id="create-workspace" className="text-sm font-medium">{creating ? 'New workspace' : 'Create a workspace'}</h2>
        <FieldGroup>
          <Field><FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel><Input id="workspace-name" required maxLength={255} placeholder="Acme Inc" value={name} onChange={event => setName(event.target.value)} /></Field>
          <Field>
            <FieldLabel htmlFor="workspace-slug">Workspace URL</FieldLabel>
            <div className="flex items-center gap-1 text-sm"><span className="text-muted-foreground">{window.location.host}/</span><Input id="workspace-slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={48} value={effectiveSlug} onChange={event => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} /></div>
            <FieldDescription>Lowercase letters, numbers and dashes. Used in links to this workspace.</FieldDescription>
          </Field>
        </FieldGroup>
        {create.isError && <Alert variant="destructive" role="alert"><AlertDescription>{create.error.message}</AlertDescription></Alert>}
        <Button type="submit" disabled={create.isPending || !name.trim() || !effectiveSlug}>{create.isPending ? 'Creating…' : 'Create workspace'}</Button>
      </form>
    </AuthLayout>
  );
}
