import * as React from 'react';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Textarea } from '@reka/ui';
import { useCreateInitiative } from '../hooks/use-initiatives';
import type { InitiativeHealth, InitiativeStatus } from '../api/initiatives.api';

export function CreateInitiativeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const create = useCreateInitiative();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<InitiativeStatus>('planned');
  const [health, setHealth] = React.useState<InitiativeHealth>('on_track');
  const [startDate, setStartDate] = React.useState('');
  const [targetDate, setTargetDate] = React.useState('');
  const [error, setError] = React.useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    try {
      await create.mutateAsync({ name: name.trim(), description: description.trim(), status, health, startDate: startDate || null, targetDate: targetDate || null });
      setName(''); setDescription(''); setStatus('planned'); setHealth('on_track'); setStartDate(''); setTargetDate(''); onOpenChange(false);
    } catch (cause) { setError((cause as Error).message); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl"><form onSubmit={submit} className="flex flex-col gap-4">
    <DialogHeader><DialogTitle>New initiative</DialogTitle><DialogDescription>Group accessible projects under a company objective. Progress is calculated from their current issue states.</DialogDescription></DialogHeader>
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">Name<Input aria-label="Initiative name" maxLength={180} value={name} onChange={event => setName(event.target.value)} required /></label>
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">Description<Textarea aria-label="Initiative description" maxLength={20000} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Status<select aria-label="Initiative status" value={status} onChange={event => setStatus(event.target.value as InitiativeStatus)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Health<select aria-label="Initiative health" value={health} onChange={event => setHealth(event.target.value as InitiativeHealth)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="off_track">Off track</option></select></label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Start date<input aria-label="Initiative start date" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Target date<input aria-label="Initiative target date" type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" /></label>
    </div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!name.trim() || create.isPending}>{create.isPending ? 'Creating…' : 'Create initiative'}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
