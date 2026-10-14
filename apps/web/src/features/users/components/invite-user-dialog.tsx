import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Field, FieldGroup, FieldLabel, FieldDescription, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@reka/ui';
import { createWorkspaceInvitation, INVITATIONS_QUERY_KEY } from '../../settings/api/workspace.api';

export function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'member' | 'admin'>('member');
  const [expiresInDays, setExpiresInDays] = React.useState(7);
  const [copyMessage, setCopyMessage] = React.useState('');
  const mutation = useMutation({ mutationFn: createWorkspaceInvitation, onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY }) });
  const created = mutation.data;
  const changeOpen = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) { mutation.reset(); setEmail(''); setRole('member'); setExpiresInDays(7); setCopyMessage(''); }
    onOpenChange(next);
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>Create a single-use link. No email is sent; share it directly with your teammate.</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-sm">Invitation for <strong className="break-all">{created.email}</strong> expires {new Date(created.expiresAt).toLocaleDateString()}.</p>
            <FieldGroup>
              <Field><FieldLabel htmlFor="invitation-link">Invitation link</FieldLabel><Input id="invitation-link" value={created.url} readOnly onFocus={event => event.target.select()} /><FieldDescription>This link is shown once. If you lose it, revoke the invitation and create another.</FieldDescription></Field>
            </FieldGroup>
            <p role="status" className="text-sm text-muted-foreground">{copyMessage}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => changeOpen(false)}>Done</Button>
              <Button onClick={async () => { try { await navigator.clipboard.writeText(created.url); setCopyMessage('Link copied.'); } catch { setCopyMessage('Could not copy. Select the link above and copy it manually.'); } }}>Copy invitation link</Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); mutation.mutate({ email: email.trim().toLowerCase(), role, expiresInDays }); }}>
            <FieldGroup>
              <Field><FieldLabel htmlFor="invite-email">Work email</FieldLabel><Input id="invite-email" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={255} autoFocus disabled={mutation.isPending} /><FieldDescription>The recipient must have this email verified on their GitHub account.</FieldDescription></Field>
              <Field><FieldLabel htmlFor="invite-role">Role</FieldLabel><Select value={role} onValueChange={value => setRole(value as 'member' | 'admin')} disabled={mutation.isPending}><SelectTrigger id="invite-role" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="member">Member</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectGroup></SelectContent></Select></Field>
              <Field><FieldLabel htmlFor="invite-expiry">Expires in days</FieldLabel><Input id="invite-expiry" type="number" min={1} max={30} required value={expiresInDays} onChange={event => setExpiresInDays(Number(event.target.value))} disabled={mutation.isPending} /></Field>
            </FieldGroup>
            {mutation.isError && <Alert variant="destructive"><AlertDescription>{mutation.error.message}</AlertDescription></Alert>}
            <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => changeOpen(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creating link…' : 'Create invitation link'}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
