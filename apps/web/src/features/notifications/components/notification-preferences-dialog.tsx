import * as React from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Alert, AlertDescription } from '@reka/ui';
import { useNotificationPreferences, useSaveNotificationPreferences } from '../hooks/use-notifications';
import type { NotificationPreferences } from '../api/notification-preferences.api';

const OPTIONS: { key: keyof NotificationPreferences; title: string; description: string }[] = [
  { key: 'mentions', title: 'Mentions', description: 'Someone mentions you on an issue.' },
  { key: 'comments', title: 'Comments', description: 'A followed issue or assigned issue receives a comment.' },
  { key: 'assignments', title: 'Assignments', description: 'An issue is assigned to you.' },
  { key: 'issueUpdates', title: 'Issue updates', description: 'A followed issue changes status or is blocked.' },
  { key: 'projectUpdates', title: 'Project updates', description: 'Project updates and project invitations.' },
  { key: 'github', title: 'GitHub', description: 'Pull request reviews, approvals and merges.' },
  { key: 'teamInvites', title: 'Team invitations', description: 'You are added to a team.' },
];

export function NotificationPreferencesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useNotificationPreferences();
  const save = useSaveNotificationPreferences();
  const [values, setValues] = React.useState<NotificationPreferences | null>(null);
  React.useEffect(() => { if (query.data) setValues(query.data); }, [query.data]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg">
    <form onSubmit={event => { event.preventDefault(); if (!values) return; save.mutate(values, { onSuccess: () => onOpenChange(false) }); }} className="flex flex-col gap-4">
      <DialogHeader><DialogTitle>Notification preferences</DialogTitle><DialogDescription>Choose which in-app notifications are created for you. Access is checked again when notifications are read.</DialogDescription></DialogHeader>
      {query.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading preferences…</p>}
      {query.isError && <Alert variant="destructive"><AlertDescription>Could not load preferences. <Button type="button" variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert>}
      {save.isError && <Alert variant="destructive"><AlertDescription>Could not save preferences. Check your connection and try again.</AlertDescription></Alert>}
      {values && <fieldset disabled={save.isPending} className="flex flex-col divide-y divide-border/60 rounded-md border border-border/70 px-3">
        <legend className="sr-only">In-app notification categories</legend>
        {OPTIONS.map(option => <label key={option.key} className="flex cursor-pointer items-center justify-between gap-4 py-3">
          <span className="flex flex-col gap-0.5"><span className="text-sm font-medium">{option.title}</span><span className="text-xs text-muted-foreground">{option.description}</span></span>
          <input aria-label={option.title} type="checkbox" checked={values[option.key]} onChange={event => setValues(current => current ? { ...current, [option.key]: event.target.checked } : current)} className="size-4 shrink-0 accent-primary" />
        </label>)}
      </fieldset>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!values || query.isLoading || query.isError || save.isPending}>{save.isPending ? 'Saving…' : 'Save preferences'}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
