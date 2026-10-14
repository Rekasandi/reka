import * as React from 'react';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@reka/ui';
import { RefreshCw } from 'lucide-react';
import { useTeams } from '../../teams/hooks/use-teams';
import { useSaveTeamCycleSettings, useTeamCycleSettings } from '../hooks/use-cycles';

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function CycleScheduleDialog({ open, onOpenChange, defaultTeamId }: { open: boolean; onOpenChange: (open: boolean) => void; defaultTeamId?: string }) {
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError, refetch: refetchTeams } = useTeams();
  const [teamId, setTeamId] = React.useState(defaultTeamId ?? '');
  const { data: settings, isLoading, isError, refetch } = useTeamCycleSettings(teamId);
  const save = useSaveTeamCycleSettings(teamId);
  const [timezone, setTimezone] = React.useState(localTimezone);
  const [durationDays, setDurationDays] = React.useState('14');
  const [cooldownDays, setCooldownDays] = React.useState('0');
  const [nextStartDate, setNextStartDate] = React.useState(localToday);
  const [autoCreate, setAutoCreate] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open || !teams.length) return;
    if (!teamId || !teams.some(team => team.id === teamId)) setTeamId(defaultTeamId && teams.some(team => team.id === defaultTeamId) ? defaultTeamId : teams[0].id);
  }, [open, teams, teamId, defaultTeamId]);
  React.useEffect(() => {
    if (!open || !teamId || isLoading || isError) return;
    setTimezone(settings?.timezone ?? localTimezone());
    setDurationDays(String(settings?.durationDays ?? 14));
    setCooldownDays(String(settings?.cooldownDays ?? 0));
    setNextStartDate(settings?.nextStartDate ?? localToday());
    setAutoCreate(settings?.autoCreate ?? false);
  }, [open, teamId, settings, isLoading, isError]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const duration = Number(durationDays); const cooldown = Number(cooldownDays);
    if (!Number.isInteger(duration) || duration < 1 || duration > 90 || !Number.isInteger(cooldown) || cooldown < 0 || cooldown > 90) {
      setError('Duration must be 1–90 days and cooldown 0–90 days.'); return;
    }
    try {
      await save.mutateAsync({ timezone: timezone.trim(), durationDays: duration, cooldownDays: cooldown, nextStartDate, autoCreate });
      onOpenChange(false);
    } catch (cause) { setError((cause as Error).message); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><form onSubmit={submit} className="flex flex-col gap-4">
    <DialogHeader><DialogTitle>Cycle schedule</DialogTitle><DialogDescription>Configure team timezone, cycle length and cooldown. Automatic cycles are created by the worker; overlapping dates are rejected.</DialogDescription></DialogHeader>
    {teamsError ? <Alert variant="destructive"><AlertDescription>Could not load teams. <Button type="button" variant="link" className="h-auto p-0" onClick={() => void refetchTeams()}>Retry</Button></AlertDescription></Alert> : <>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">Team<Select value={teamId} onValueChange={setTeamId} disabled={teamsLoading}><SelectTrigger aria-label="Cycle schedule team"><SelectValue placeholder={teamsLoading ? 'Loading teams…' : 'Choose a team'} /></SelectTrigger><SelectContent><SelectGroup>{teams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectGroup></SelectContent></Select></label>
      {isLoading && <div role="status" aria-label="Loading cycle schedule" className="text-sm text-muted-foreground">Loading saved schedule…</div>}
      {isError && <Alert variant="destructive"><AlertDescription>Could not load this team schedule. <Button type="button" variant="link" className="h-auto p-0" onClick={() => void refetch()}>Retry</Button></AlertDescription></Alert>}
      {!isLoading && !isError && !!teamId && <>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">IANA timezone<Input aria-label="Cycle timezone" value={timezone} onChange={event => setTimezone(event.target.value)} placeholder="America/Los_Angeles" required /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-xs text-muted-foreground">Duration (days)<Input aria-label="Cycle duration days" type="number" min={1} max={90} step={1} value={durationDays} onChange={event => setDurationDays(event.target.value)} required /></label><label className="flex flex-col gap-1 text-xs text-muted-foreground">Cooldown (days)<Input aria-label="Cycle cooldown days" type="number" min={0} max={90} step={1} value={cooldownDays} onChange={event => setCooldownDays(event.target.value)} required /></label></div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Next cycle start<input aria-label="Next cycle start date" type="date" value={nextStartDate} onChange={event => setNextStartDate(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground" required /></label>
        <label className="flex items-start gap-2 text-sm"><input aria-label="Automatically create cycles" type="checkbox" checked={autoCreate} onChange={event => setAutoCreate(event.target.checked)} className="mt-0.5 accent-primary" /><span><span className="font-medium">Automatically create cycles</span><span className="mt-0.5 block text-xs text-muted-foreground">Requires the worker to be running; each planned start is created once.</span></span></label>
      </>}
    </>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={!teamId || isLoading || isError || save.isPending}>{save.isPending ? 'Saving…' : 'Save schedule'}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
