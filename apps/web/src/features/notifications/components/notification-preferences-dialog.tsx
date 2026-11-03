import { useForm } from '@tanstack/react-form';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Alert, AlertDescription, Label, Checkbox, FieldSet, FieldLegend, FieldGroup, Spinner } from '@reka/ui';
import { useNotificationPreferences, useSaveNotificationPreferences } from '../hooks/use-notifications';
import type { NotificationPreferences } from '../api/notification-preferences.api';

const OPTIONS: { key: Exclude<keyof NotificationPreferences, 'emailNotifications'>; title: string; description: string }[] = [
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
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg">
    {query.data
      ? <PreferencesForm initial={query.data} onOpenChange={onOpenChange} />
      : <div className="flex flex-col gap-4">
        <DialogHeader><DialogTitle>Notification preferences</DialogTitle><DialogDescription>Choose which in-app notifications are created for you. Access is checked again when notifications are read.</DialogDescription></DialogHeader>
        {query.isLoading && <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><Spinner className="size-3.5" aria-label="Loading preferences" />Loading preferences…</p>}
        {query.isError && <Alert variant="destructive"><AlertDescription>Could not load preferences. <Button type="button" variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled>Save preferences</Button></DialogFooter>
      </div>}
  </DialogContent></Dialog>;
}

/** Mounted once the preferences have loaded, so the form starts from the server values. */
function PreferencesForm({ initial, onOpenChange }: { initial: NotificationPreferences; onOpenChange: (open: boolean) => void }) {
  const save = useSaveNotificationPreferences();
  const form = useForm({
    defaultValues: initial,
    onSubmit: ({ value }) => { save.mutate(value, { onSuccess: () => onOpenChange(false) }); },
  });
  return <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }} className="flex flex-col gap-4">
    <DialogHeader><DialogTitle>Notification preferences</DialogTitle><DialogDescription>Choose which in-app notifications are created for you. Access is checked again when notifications are read.</DialogDescription></DialogHeader>
    {save.isError && <Alert variant="destructive"><AlertDescription>Could not save preferences. Check your connection and try again.</AlertDescription></Alert>}
    <FieldSet disabled={save.isPending} className="gap-0 divide-y divide-border/60 rounded-md border border-border/70 px-3">
      <FieldLegend className="sr-only">In-app notification categories</FieldLegend>
      <FieldGroup className="gap-0">
        {OPTIONS.map(option => <form.Field key={option.key} name={option.key}>
          {field => <Label className="flex cursor-pointer items-center justify-between gap-4 py-3">
            <span className="flex flex-col gap-0.5"><span className="text-sm font-medium">{option.title}</span><span className="text-xs text-muted-foreground">{option.description}</span></span>
            <Checkbox name={field.name} aria-label={option.title} checked={!!field.state.value} onCheckedChange={checked => field.handleChange(checked === true)} className="shrink-0" />
          </Label>}
        </form.Field>)}
      </FieldGroup>
    </FieldSet>
    <FieldSet disabled={save.isPending} className="gap-0 rounded-md border border-border/70 px-3">
      <FieldLegend className="sr-only">Email</FieldLegend>
      <form.Field name="emailNotifications">
        {field => <Label className="flex cursor-pointer items-center justify-between gap-4 py-3">
          <span className="flex flex-col gap-0.5"><span className="text-sm font-medium">Email me too</span><span className="text-xs text-muted-foreground">Also send an email for each notification you receive above. Off by default.</span></span>
          <Checkbox name={field.name} aria-label="Email notifications" checked={!!field.state.value} onCheckedChange={checked => field.handleChange(checked === true)} className="shrink-0" />
        </Label>}
      </form.Field>
    </FieldSet>
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save preferences'}</Button></DialogFooter>
  </form>;
}
