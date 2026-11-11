import * as React from 'react';
import { CalendarRange, CirclePause, Globe } from 'lucide-react';
import { TeamPicker } from '../../issues/components/team-picker';
import { PropertyPicker } from '../../../components/common/property-picker';
import { useForm } from '@tanstack/react-form';
import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Checkbox, Field, FieldLabel, FieldError, DatePicker, parseDateOnly, toDateOnly, Spinner } from '@reka/ui';
import { useTeams } from '../../teams/hooks/use-teams';
import { useSaveTeamCycleSettings, useTeamCycleSettings } from '../hooks/use-cycles';

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const FIELD_PICKER = 'h-8 w-full justify-start px-3';
const DURATION_DAYS = [7, 14, 21, 28, 42, 56];
const COOLDOWN_DAYS = [0, 1, 2, 3, 7, 14];
const dayLabel = (days: number) => days === 0 ? 'No cooldown' : days % 7 === 0 ? `${days / 7} week${days === 7 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'}`;
// A saved value outside the presets (set before pickers existed) stays selectable.
const dayOptions = (presets: number[], current: string) => [...new Set([...presets, Number(current)])].filter(Number.isFinite).sort((a, b) => a - b)
  .map(days => ({ key: String(days), label: dayLabel(days), hint: days >= 7 && days % 7 === 0 ? `${days} days` : undefined, icon: days === 0 ? CirclePause : CalendarRange }));
const TIMEZONES: string[] = Intl.supportedValuesOf?.('timeZone') ?? [];
const timezoneOptions = (current: string) => [...new Set(['UTC', ...TIMEZONES, current].filter(Boolean))].map(zone => ({ key: zone, label: zone.replaceAll('_', ' '), icon: Globe }));
const AUTOMATIONS = [
  { name: 'autoCreate', id: 'cycle-auto-create', label: 'Automatically create cycles', description: 'Requires the worker to be running; each planned start is created once.' },
  { name: 'autoAddStarted', id: 'cycle-auto-add-started', label: 'Auto-add started issues', description: 'Issues moved to a Started status join the current cycle if they have no cycle yet.' },
  { name: 'autoRollover', id: 'cycle-auto-rollover', label: 'Auto-close ended cycles', description: 'When a cycle ends, close it and move unfinished issues to the next open cycle. A cycle with unfinished work stays open until a later cycle exists. Requires the worker.' },
] as const;

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
        <form.Field name="timezone" children={field => <Field><FieldLabel htmlFor="cycle-timezone" className="text-xs text-muted-foreground">Timezone</FieldLabel><PropertyPicker id="cycle-timezone" className={FIELD_PICKER} menuLabel="Timezone" ariaLabel="Cycle timezone" shortcuts={false} value={field.state.value} options={timezoneOptions(field.state.value)} onChange={field.handleChange} /></Field>} />
        <div className="grid gap-3 sm:grid-cols-2">
          <form.Field name="durationDays" children={field => <Field><FieldLabel htmlFor="cycle-duration" className="text-xs text-muted-foreground">Duration</FieldLabel><PropertyPicker id="cycle-duration" className={FIELD_PICKER} menuLabel="Duration" ariaLabel="Cycle duration" value={field.state.value} options={dayOptions(DURATION_DAYS, field.state.value)} onChange={field.handleChange} /></Field>} />
          <form.Field name="cooldownDays" children={field => <Field><FieldLabel htmlFor="cycle-cooldown" className="text-xs text-muted-foreground">Cooldown</FieldLabel><PropertyPicker id="cycle-cooldown" className={FIELD_PICKER} menuLabel="Cooldown" ariaLabel="Cycle cooldown" value={field.state.value} options={dayOptions(COOLDOWN_DAYS, field.state.value)} onChange={field.handleChange} /></Field>} />
        </div>
        <form.Field name="nextStartDate" validators={{ onChange: ({ value }) => (!value ? 'Choose the next cycle start date.' : undefined) }} children={field => <Field data-invalid={!field.state.meta.isValid}><FieldLabel className="text-xs text-muted-foreground">Next cycle start</FieldLabel><DatePicker aria-label="Next cycle start date" date={parseDateOnly(field.state.value)} onDateChange={date => field.handleChange(toDateOnly(date))} />{!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}</Field>} />
        {AUTOMATIONS.map(automation => <form.Field key={automation.name} name={automation.name} children={field => <Field orientation="horizontal" className="items-start justify-start gap-2 text-sm">
          <Checkbox id={automation.id} aria-label={automation.label} checked={field.state.value} onCheckedChange={checked => field.handleChange(checked === true)} className="mt-0.5" />
          <div className="flex min-w-0 flex-col gap-0.5"><FieldLabel htmlFor={automation.id} className="font-medium">{automation.label}</FieldLabel><span className="text-xs text-muted-foreground">{automation.description}</span></div>
        </Field>} />)}
      </>}
    </>}
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><form.Subscribe selector={state => state.canSubmit} children={canSubmit => <Button type="submit" disabled={!canSubmit || !teamId || isLoading || isError || save.isPending}>{save.isPending ? 'Saving…' : 'Save schedule'}</Button>} /></DialogFooter>
  </form></DialogContent></Dialog>;
}
