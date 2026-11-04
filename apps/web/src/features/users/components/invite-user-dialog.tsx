import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Field, FieldGroup, FieldLabel, FieldDescription, Input } from '@reka/ui';
import { SelectField } from '../../../components/common/select-field';
import { authClient, authErrorMessage } from '../../../lib/auth-client';
import { INVITATIONS_QUERY_KEY } from '../../settings/api/workspace.api';

const ROLES = [{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }, { value: 'guest', label: 'Guest (read-only)' }];

/** Invite someone by email. REKA emails them a link; the link is also shown here to share by hand. */
export function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState('member');
  const [copyMessage, setCopyMessage] = React.useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.organization.inviteMember({ email: email.trim().toLowerCase(), role: role as 'member' | 'admin' | 'guest' });
      if (result.error) throw new Error(authErrorMessage(result.error, 'Could not create the invitation.'));
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY }),
  });
  const created = mutation.data;
  const link = created ? `${window.location.origin}/accept-invitation/${created.id}` : '';
  const changeOpen = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) { mutation.reset(); setEmail(''); setRole('member'); setCopyMessage(''); }
    onOpenChange(next);
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>They get an email with a link and join this workspace after signing in with that address. Team membership is added separately.</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="flex min-w-0 flex-col gap-4">
            <Alert role="status"><AlertDescription>Invitation sent to <strong className="break-all">{created.email}</strong> as {created.role}. It expires {new Date(created.expiresAt).toLocaleDateString()}.</AlertDescription></Alert>
            <FieldGroup>
              <Field><FieldLabel htmlFor="invitation-link">Invitation link</FieldLabel><Input id="invitation-link" value={link} readOnly onFocus={event => event.target.select()} /><FieldDescription>Share this if the email does not arrive. It only works for {created.email}.</FieldDescription></Field>
            </FieldGroup>
            <FieldDescription role="status" className="text-sm text-muted-foreground">{copyMessage}</FieldDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => changeOpen(false)}>Done</Button>
              <Button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopyMessage('Link copied.'); } catch { setCopyMessage('Could not copy. Select the link above and copy it manually.'); } }}>Copy invitation link</Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
            <FieldGroup>
              <Field><FieldLabel htmlFor="invite-email">Work email</FieldLabel><Input id="invite-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></Field>
              <Field><FieldLabel htmlFor="invite-role">Workspace role</FieldLabel><SelectField id="invite-role" aria-label="Workspace role" size="default" className="w-full" value={role} onValueChange={setRole} options={ROLES} /></Field>
            </FieldGroup>
            {mutation.isError && <Alert variant="destructive" role="alert"><AlertDescription>{mutation.error.message}</AlertDescription></Alert>}
            <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => changeOpen(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending || !email.trim()}>{mutation.isPending ? 'Sending…' : 'Send invitation'}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
