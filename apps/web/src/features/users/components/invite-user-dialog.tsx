import * as React from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Field, FieldGroup, FieldLabel, FieldDescription, Input, FieldError, Checkbox } from '@reka/ui';
import { SelectField } from '../../../components/common/select-field';
import { createWorkspaceInvitation, INVITATIONS_QUERY_KEY } from '../../settings/api/workspace.api';

export function InviteUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [copyMessage, setCopyMessage] = React.useState('');
  const mutation = useMutation({ mutationFn: createWorkspaceInvitation, onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY }) });
  const form = useForm({
    defaultValues: { email: '', role: 'member' as 'member' | 'admin', expiresInDays: 7, sendEmail: true },
    onSubmit: ({ value }) => { mutation.mutate({ email: value.email.trim().toLowerCase(), role: value.role, expiresInDays: value.expiresInDays, sendEmail: value.sendEmail }); },
  });
  const created = mutation.data;
  const changeOpen = (next: boolean) => {
    if (mutation.isPending) return;
    if (!next) { mutation.reset(); form.reset(); setCopyMessage(''); }
    onOpenChange(next);
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>Invite someone to this workspace with a single-use link. We can email it to them, and you can always copy it to share yourself. Team membership is added separately.</DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-sm">Invitation for <strong className="break-all">{created.email}</strong> expires {new Date(created.expiresAt).toLocaleDateString()}.</p>
            {created.emailSent
              ? <Alert role="status"><AlertDescription>Invitation emailed to <strong className="break-all">{created.email}</strong>. You can also share the link below.</AlertDescription></Alert>
              : created.emailError ? <Alert role="status"><AlertDescription>The email was not sent ({created.emailError.toLowerCase()}). Copy the link below and share it directly.</AlertDescription></Alert> : null}
            <FieldGroup>
              <Field><FieldLabel htmlFor="invitation-link">Invitation link</FieldLabel><Input id="invitation-link" value={created.url} readOnly onFocus={event => event.target.select()} /><FieldDescription>This link is shown once. If you lose it, revoke the invitation and create another.</FieldDescription></Field>
            </FieldGroup>
            <FieldDescription role="status" className="text-sm text-muted-foreground">{copyMessage}</FieldDescription>
            <DialogFooter>
              <Button variant="outline" onClick={() => changeOpen(false)}>Done</Button>
              <Button onClick={async () => { try { await navigator.clipboard.writeText(created.url); setCopyMessage('Link copied.'); } catch { setCopyMessage('Could not copy. Select the link above and copy it manually.'); } }}>Copy invitation link</Button>
            </DialogFooter>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); event.stopPropagation(); form.handleSubmit(); }}>
            <FieldGroup>
              <form.Field name="email" validators={{ onChange: ({ value }) => (!value.trim() ? 'Work email is required' : !/^\S+@\S+\.\S+$/.test(value.trim()) ? 'Enter a valid email address' : undefined) }}>
                {field => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return <Field data-invalid={isInvalid}><FieldLabel htmlFor="invite-email">Work email</FieldLabel><Input id="invite-email" name={field.name} type="email" value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} required maxLength={255} autoFocus disabled={mutation.isPending} /><FieldDescription>The recipient must have this email verified on their GitHub account.</FieldDescription>{isInvalid && <FieldError errors={field.state.meta.errors as string[]} />}</Field>;
                }}
              </form.Field>
              <form.Field name="role">
                {field => <Field><FieldLabel htmlFor="invite-role">Workspace role</FieldLabel><SelectField id="invite-role" size="default" name={field.name} className="w-full" value={field.state.value} onValueChange={value => field.handleChange(value as 'member' | 'admin')} disabled={mutation.isPending} options={[{ value: 'member', label: 'Member' }, { value: 'admin', label: 'Admin' }]} /></Field>}
              </form.Field>
              <form.Field name="sendEmail">
                {field => <Field orientation="horizontal" className="items-start gap-2"><Checkbox id="invite-send-email" aria-label="Email the invitation" checked={field.state.value} onCheckedChange={checked => field.handleChange(checked === true)} className="mt-0.5" /><FieldLabel htmlFor="invite-send-email" className="flex flex-col items-start gap-0"><span className="font-medium">Email the invitation</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Sends the link to the address above.</span></FieldLabel></Field>}
              </form.Field>
              <form.Field name="expiresInDays">
                {field => <Field><FieldLabel htmlFor="invite-expiry">Expires in days</FieldLabel><Input id="invite-expiry" name={field.name} type="number" min={1} max={30} required value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(Number(event.target.value))} disabled={mutation.isPending} /></Field>}
              </form.Field>
            </FieldGroup>
            {mutation.isError && <Alert variant="destructive"><AlertDescription>{mutation.error.message}</AlertDescription></Alert>}
            <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => changeOpen(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creating link…' : 'Create invitation link'}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
