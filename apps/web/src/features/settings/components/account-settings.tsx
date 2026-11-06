import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Badge, Button, Field, FieldDescription, FieldGroup, FieldLabel, Input, toast } from '@reka/ui';
import { ExternalLink } from 'lucide-react';
import { authClient, authErrorMessage } from '../../../lib/auth-client';
import { useAuth, useLogout } from '../../auth/hooks/use-auth';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';
import { GithubIcon } from './github-settings';
import { leaveWorkspace } from '../api/workspace.api';

const ACCOUNTS_QUERY_KEY = ['auth', 'accounts'] as const;
/** Sign-in methods linked to the account (Better Auth: "credential" = password, "github" = OAuth). */
function useLinkedAccounts() {
  return useQuery({ queryKey: ACCOUNTS_QUERY_KEY, queryFn: async () => {
    const result = await authClient.listAccounts();
    if (result.error) throw new Error(authErrorMessage(result.error, 'Could not load your sign-in methods.'));
    return result.data ?? [];
  } });
}

function ChangePassword({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const change = useMutation({
    mutationFn: async () => {
      const result = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
      if (result.error) throw new Error(authErrorMessage(result.error, 'Could not change the password.'));
    },
    onSuccess: () => { setCurrent(''); setNext(''); toast.success('Password changed. Other devices were signed out.'); },
  });
  const setPassword = useMutation({
    mutationFn: async () => {
      const result = await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
      if (result.error) throw new Error(authErrorMessage(result.error, 'Could not send the email.'));
    },
    onSuccess: () => toast.success('Check your inbox for a link to set a password.'),
  });
  if (!hasPassword) return <section className="flex flex-col items-start gap-3 border-t border-border pt-6"><div><h2 className="text-sm font-medium">Password</h2><p className="mt-1 text-sm text-muted-foreground">You sign in with GitHub or magic links. Add a password to sign in with it as well.</p></div>
    {setPassword.isError && <Alert variant="destructive"><AlertDescription>{setPassword.error.message}</AlertDescription></Alert>}
    <Button variant="outline" disabled={setPassword.isPending} onClick={() => setPassword.mutate()}>{setPassword.isPending ? 'Sending…' : 'Email me a link to set a password'}</Button></section>;
  return <section className="flex flex-col gap-4 border-t border-border pt-6"><div><h2 className="text-sm font-medium">Password</h2><p className="mt-1 text-sm text-muted-foreground">Changing it signs out your other devices.</p></div>
    {change.isError && <Alert variant="destructive"><AlertDescription>{change.error.message}</AlertDescription></Alert>}
    <form className="flex max-w-sm flex-col gap-4" onSubmit={event => { event.preventDefault(); change.mutate(); }}>
      <FieldGroup>
        <Field><FieldLabel htmlFor="current-password">Current password</FieldLabel><Input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={event => setCurrent(event.target.value)} /></Field>
        <Field><FieldLabel htmlFor="new-password">New password</FieldLabel><Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={event => setNext(event.target.value)} /><FieldDescription>At least 8 characters.</FieldDescription></Field>
      </FieldGroup>
      <div><Button type="submit" disabled={change.isPending || !current || next.length < 8}>{change.isPending ? 'Saving…' : 'Change password'}</Button></div>
    </form></section>;
}

function ChangeEmail({ email }: { email: string }) {
  const [next, setNext] = React.useState('');
  const change = useMutation({
    mutationFn: async () => {
      const result = await authClient.changeEmail({ newEmail: next.trim().toLowerCase(), callbackURL: '/settings/profile' });
      if (result.error) throw new Error(authErrorMessage(result.error, 'Could not change the email.'));
    },
    onSuccess: () => { toast.success(`We sent a confirmation link to ${email}. The new address is verified afterwards.`); setNext(''); },
  });
  return <section className="flex flex-col gap-4 border-t border-border pt-6"><div><h2 className="text-sm font-medium">Email address</h2><p className="mt-1 text-sm text-muted-foreground">Your current address must confirm the change, then the new one gets a verification email.</p></div>
    {change.isError && <Alert variant="destructive"><AlertDescription>{change.error.message}</AlertDescription></Alert>}
    <form className="flex max-w-sm flex-col gap-4" onSubmit={event => { event.preventDefault(); change.mutate(); }}>
      <FieldGroup><Field><FieldLabel htmlFor="new-email">New email</FieldLabel><Input id="new-email" type="email" autoComplete="email" required value={next} onChange={event => setNext(event.target.value)} /></Field></FieldGroup>
      <div><Button type="submit" variant="outline" disabled={change.isPending || !next.trim() || next.trim().toLowerCase() === email}>{change.isPending ? 'Sending…' : 'Change email'}</Button></div>
    </form></section>;
}

function DangerZone() {
  const { user } = useAuth();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = React.useState<'leave' | 'delete' | null>(null);
  const workspace = user?.workspace ?? null;
  const leave = useMutation({
    mutationFn: () => leaveWorkspace(workspace!.id),
    onSuccess: () => { queryClient.clear(); window.location.assign('/'); },
  });
  const remove = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/account', { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || 'Could not delete the account.');
    },
    onSuccess: () => logout.mutate(),
  });
  return <section className="flex flex-col gap-4 border-t border-border pt-6" aria-labelledby="danger-title"><div><h2 id="danger-title" className="text-sm font-medium text-destructive">Danger zone</h2><p className="mt-1 text-sm text-muted-foreground">Issues and comments you wrote stay in the workspace; only your access and identity are removed.</p></div>
    {(leave.isError || remove.isError) && <Alert variant="destructive"><AlertDescription>{(leave.error ?? remove.error)?.message}</AlertDescription></Alert>}
    <div className="flex flex-wrap gap-2">
      {workspace && <Button variant="outline" disabled={leave.isPending} onClick={() => setConfirm('leave')}>Leave {workspace.name}</Button>}
      <Button variant="destructive" disabled={remove.isPending} onClick={() => setConfirm('delete')}>Delete account</Button>
    </div>
    <ConfirmDeleteDialog open={confirm === 'leave'} onOpenChange={open => setConfirm(open ? 'leave' : null)} title={`Leave ${workspace?.name}?`} description="You lose access until someone invites you again. The last owner cannot leave." confirmLabel="Leave workspace" onConfirm={() => leave.mutate()} />
    <ConfirmDeleteDialog open={confirm === 'delete'} onOpenChange={open => setConfirm(open ? 'delete' : null)} title="Delete your account?" description="This cannot be undone. Your sign-in methods, sessions and workspace memberships are removed; transfer or delete workspaces you own first." confirmLabel="Delete account" onConfirm={() => remove.mutate()} />
  </section>;
}

/** Profile → password, email and account removal. */
export function AccountSecurity() {
  const { user } = useAuth();
  const accounts = useLinkedAccounts();
  if (!user) return null;
  return <>
    {accounts.data && <ChangePassword hasPassword={accounts.data.some(account => account.providerId === 'credential')} email={user.email} />}
    <ChangeEmail email={user.email} />
    <DangerZone />
  </>;
}

/** Connected accounts → link or unlink GitHub. */
export function GithubAccount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accounts = useLinkedAccounts();
  const githubAccount = accounts.data?.find(account => account.providerId === 'github');
  const linked = Boolean(githubAccount);
  const username = user?.githubUsername;
  const link = useMutation({
    mutationFn: async () => {
      const result = await authClient.linkSocial({ provider: 'github', callbackURL: '/settings/accounts' });
      if (result.error) throw new Error(authErrorMessage(result.error, 'Could not start the GitHub link.'));
    },
  });
  const unlink = useMutation({
    mutationFn: async () => {
      const accountId = githubAccount?.id ?? githubAccount?.accountId ?? 'github';
      const result = await (authClient.unlinkAccount as (args: { accountId?: string; providerId?: string }) => Promise<{ error?: unknown }>)({ accountId, providerId: 'github' });
      if (result.error) throw new Error(authErrorMessage(result.error, 'Could not unlink GitHub.'));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY }); queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }); toast.success('GitHub unlinked'); },
  });
  let statusText = 'No verified GitHub identity available';
  if (linked) {
    statusText = username ? `@${username}` : 'Linked';
  }
  return <section className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5"><div className="flex min-w-0 items-center gap-3"><GithubIcon className="size-5 shrink-0" /><div><h2 className="text-sm font-medium">GitHub</h2><p className="text-sm text-muted-foreground">{statusText}</p></div></div>{linked && <Badge variant="success">Connected</Badge>}</div>
    <p className="text-sm text-muted-foreground">Sign in with GitHub and let REKA create issues and branches on your behalf. Workspace GitHub App installations are managed under Integrations.</p>
    {(link.isError || unlink.isError) && <Alert variant="destructive"><AlertDescription>{(link.error ?? unlink.error)?.message}</AlertDescription></Alert>}
    <div className="flex flex-wrap gap-2">
      {linked ? <Button variant="outline" size="sm" disabled={unlink.isPending} onClick={() => unlink.mutate()}>{unlink.isPending ? 'Unlinking…' : 'Unlink GitHub'}</Button>
        : <Button size="sm" disabled={link.isPending || accounts.isLoading} onClick={() => link.mutate()}>{link.isPending ? 'Redirecting…' : 'Link GitHub'}</Button>}
      {username && <Button variant="outline" size="sm" asChild><a href={`https://github.com/${username}`} target="_blank" rel="noopener noreferrer">View on GitHub<ExternalLink data-icon="inline-end" /></a></Button>}
      <Button variant="outline" size="sm" asChild><Link to="/settings/github">GitHub integration</Link></Button>
    </div>
  </section>;
}
