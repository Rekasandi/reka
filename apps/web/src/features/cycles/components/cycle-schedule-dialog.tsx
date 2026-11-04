import * as React from 'react';
import { TeamPicker } from '../../issues/components/team-picker';
import { useForm } from '@tanstack/react-form';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Field, FieldLabel, FieldError, Checkbox, DatePicker, parseDateOnly, toDateOnly, Spinner } from '@reka/ui';
import { RefreshCw } from 'lucide-react';
import { SelectField } from '../../../components/common/select-field';
import { useTeams } from '../../teams/hooks/use-teams';
import { useSaveTeamCycleSettings, useTeamCycleSettings } from '../hooks/use-cycles';

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function CycleScheduleDialog({ open, onOpenChange, defaultTeamId }: { open: boolean; onOpenChange: (open: boolean) => void; defaultTeamId?: string }) {
  const { data: allTeams = [], isLoading: teamsLoading, isError: teamsError, refetch: refetchTeams } = useTeams();
  const teams = React.useMemo(() => allTeams.filter(team => team.cyclesEnabled !== false), [allTeams]);
  const [teamId, setTeamId] = React.useState(defaultTeamId ?? '');
  const { data: settings, isLoading, isError, refetch } = useTeamCycleSettings(teamId);
  const save = useSaveTeamCycleSettings(teamId);
  const [error, setError] = React.useState('');
  const form = useForm({
    defaultValues: {
      timezone: settings?.timezone ?? localTimezone(), durationDays: String(settings?.durationDays ?? 14), cooldownDays: String(settings?.cooldownDays ?? 0),
      nextStartDate: settings?.nextStartDate ?? localToday(), autoCreate: settings?.autoCreate ?? false, autoAddStarted: settings?.autoAddStarted ?? false, autoRollover: settings?.autoRollover ?? false,
    },
    onSubmit: async ({ value }) => {
      setError('');
      const duration = Number(value.durationDays); const cooldown = Number(value.cooldownDays);
      try {
        await save.mutateAsync({ timezone: value.timezone.trim(), durationDays: duration, cooldownDays: cooldown, nextStartDate: value.nextStartDate, autoCreate: value.autoCreate, autoAddStarted: value.autoAddStarted, autoRollover: value.autoRollover });
        onOpenChange(false);
      } catch (cause) { setError((cause as Error).message); }
    },
  });

  React.useEffect(() => {
    if (!open || !teams.length) return;
    if (!teamId || !teams.some(team => team.id === teamId)) setTeamId(defaultTeamId && teams.some(team => team.id === defaultTeamId) ? defaultTeamId : teams[0].id);
  }, [open, teams, teamId, defaultTeamId]);
  React.useEffect(() => {
    if (!open || !teamId || isLoading || isError) return;
    form.reset();
  }, [open, teamId, settings, isLoading, isError]);

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><form onSubmit={e => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit(); }} className="flex flex-col gap-4">
    <DialogHeader><DialogTitle>Cycle schedule</DialogTitle><DialogDescription>Configure team timezone, cycle length and cooldown. Automatic cycles are created by the worker; overlapping dates are rejected.</DialogDescription></DialogHeader>
    {teamsError ? <Alert variant="destructive"><AlertDescription>Could not load teams. <Button type="button" variant="link" className="h-auto p-0" onClick={() => void refetchTeams()}>Retry</Button></AlertDescription></Alert> : <>
      <Field><FieldLabel htmlFor="cycle-schedule-team" className="text-xs text-muted-foreground">Team</FieldLabel><TeamPicker id="cycle-schedule-team" label="Cycle schedule team" teams={teams} teamId={teamId} onTeamChange={setTeamId} disabled={teamsLoading} placeholder={teamsLoading ? 'Loading teams…' : 'Choose a team'} className="h-8 w-full justify-start" /></Field>
      {isLoading && <div className="text-sm text-muted-foreground"><Spinner aria-label="Loading cycle schedule" /> Loading saved schedule…</div>}
      {isError && <Alert variant="destructive"><AlertDescription>Could not load this team schedule. <Button type="button" variant="link" className="h-auto p-0" onClick={() => void refetch()}>Retry</Button></AlertDescription></Alert>}
      {!isLoading && !isError && !!teamId && <>
        <form.Field name="timezone" children={field => <Field><FieldLabel htmlFor="cycle-timezone" className="text-xs text-muted-foreground">IANA timezone</FieldLabel><Input id="cycle-timezone" name={field.name} aria-label="Cycle timezone" value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} placeholder="America/Los_Angeles" required /></Field>} />
        <div className="grid gap-3 sm:grid-cols-2">
          <form.Field name="durationDays" validators={{ onChange: ({ value }) => { const n = Number(value); return !Number.isInteger(n) || n < 1 || n > 90 ? 'Duration must be 1–90 days.' : undefined; } }} children={field => <Field data-invalid={!field.state.meta.isValid}><FieldLabel htmlFor="cycle-duration" className="text-xs text-muted-foreground">Duration (days)</FieldLabel><Input id="cycle-duration" name={field.name} aria-label="Cycle duration days" type="number" min={1} max={90} step={1} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} required />{!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}</Field>} />
          <form.Field name="cooldownDays" validators={{ onChange: ({ value }) => { const n = Number(value); return !Number.isInteger(n) || n < 0 || n > 90 ? 'Cooldown must be 0–90 days.' : undefined; } }} children={field => <Field data-invalid={!field.state.meta.isValid}><FieldLabel htmlFor="cycle-cooldown" className="text-xs text-muted-foreground">Cooldown (days)</FieldLabel><Input id="cycle-cooldown" name={field.name} aria-label="Cycle cooldown days" type="number" min={0} max={90} step={1} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} required />{!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}</Field>} />
        </div>
        <form.Field name="nextStartDate" validators={{ onChange: ({ value }) => (!value ? 'Choose the next cycle start date.' : undefined) }} children={field => <Field data-invalid={!field.state.meta.isValid}><FieldLabel className="text-xs text-muted-foreground">Next cycle start</FieldLabel><DatePicker aria-label="Next cycle start date" date={parseDateOnly(field.state.value)} onDateChange={date => field.handleChange(toDateOnly(date))} />{!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}</Field>} />
        <form.Field name="autoCreate" children={field => <Field orientation="horizontal" className="items-start gap-2 text-sm"><Checkbox id="cycle-auto-create" aria-label="Automatically create cycles" checked={field.state.value} onCheckedChange={checked => field.handleChange(checked === true)} className="mt-0.5" /><FieldLabel htmlFor="cycle-auto-create" className="flex flex-col items-start gap-0"><span className="font-medium">Automatically create cycles</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Requires the worker to be running; each planned start is created once.</span></FieldLabel></Field>} />
        <form.Field name="autoAddStarted" children={field => <Field orientation="horizontal" className="items-start gap-2 text-sm"><Checkbox id="cycle-auto-add-started" aria-label="Auto-add started issues" checked={field.state.value} onCheckedChange={checked => field.handleChange(checked === true)} className="mt-0.5" /><FieldLabel htmlFor="cycle-auto-add-started" className="flex flex-col items-start gap-0"><span className="font-medium">Auto-add started issues</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Issues moved to a Started status join the current cycle if they have no cycle yet.</span></FieldLabel></Field>} />
        <form.Field name="autoRollover" children={field => <Field orientation="horizontal" className="items-start gap-2 text-sm"><Checkbox id="cycle-auto-rollover" aria-label="Auto-close ended cycles" checked={field.state.value} onCheckedChange={checked => field.handleChange(checked === true)} className="mt-0.5" /><FieldLabel htmlFor="cycle-auto-rollover" className="flex flex-col items-start gap-0"><span className="font-medium">Auto-close ended cycles</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">When a cycle ends, close it and move unfinished issues to the next open cycle. A cycle with unfinished work stays open until a later cycle exists. Requires the worker.</span></FieldLabel></Field>} />
      </>}
    </>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><form.Subscribe selector={state => state.canSubmit} children={canSubmit => <Button type="submit" disabled={!canSubmit || !teamId || isLoading || isError || save.isPending}>{save.isPending ? 'Saving…' : 'Save schedule'}</Button>} /></DialogFooter>
  </form></DialogContent></Dialog>;
}
