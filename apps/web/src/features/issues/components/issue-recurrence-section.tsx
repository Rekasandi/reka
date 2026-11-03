import * as React from 'react';
import { Alert, AlertDescription, Button, Input, Label, FieldError, Spinner } from '@reka/ui';
import { useForm } from '@tanstack/react-form';
import { SelectField } from '../../../components/common/select-field';
import { Repeat2 } from 'lucide-react';
import { useConfigureIssueRecurrence, useIssueRecurrence, useStopIssueRecurrence } from '../hooks/use-issue-recurrence';
import { formatDateTimeInZone, parseDateTimeInZone } from '../lib/recurrence-date';

const defaultTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function IssueRecurrenceSection({ issueId, archived = false }: { issueId: string; archived?: boolean }) {
  const query = useIssueRecurrence(issueId);
  const configure = useConfigureIssueRecurrence(issueId);
  const stop = useStopIssueRecurrence(issueId);
  const [dateError, setDateError] = React.useState('');
  const defaults = () => ({
    intervalCount: '1',
    unit: 'week' as 'day' | 'week' | 'month',
    timezone: defaultTimezone(),
    nextRunAt: formatDateTimeInZone(new Date(Date.now() + 86_400_000), defaultTimezone()),
    dueDateOffsetDays: '',
  });

  const seed = query.data ? {
    intervalCount: String(query.data.intervalCount),
    unit: query.data.unit,
    timezone: query.data.timezone,
    nextRunAt: formatDateTimeInZone(query.data.nextRunAt, query.data.timezone),
    dueDateOffsetDays: query.data.template.dueDateOffsetDays == null ? '' : String(query.data.template.dueDateOffsetDays),
  } : defaults();
  const form = useForm({
    defaultValues: seed,
    onSubmit: ({ value }) => {
      setDateError('');
      try {
        configure.mutate({
          intervalCount: Number(value.intervalCount), unit: value.unit, timezone: value.timezone.trim(), nextRunAt: parseDateTimeInZone(value.nextRunAt, value.timezone.trim()),
          dueDateOffsetDays: value.dueDateOffsetDays === '' ? null : Number(value.dueDateOffsetDays),
        });
      } catch (error) { setDateError((error as Error).message); }
    },
  });

  React.useEffect(() => { form.reset(); }, [query.data, query.isSuccess]);

  return <section aria-label="Issue recurrence" className="flex min-w-0 flex-col gap-3">
    <div className="flex items-center gap-2"><Repeat2 className="size-3.5 text-muted-foreground" /><h3 className="text-xs font-medium">Recurring issue</h3></div>
    {query.isLoading ? <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Spinner className="size-3.5" aria-label="Loading recurrence" />Loading recurrence…</p> : null}
    {query.isError ? <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-2">Could not load recurrence: {query.error.message}<Button type="button" size="xs" variant="outline" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert> : null}
    {query.isSuccess && <>
      {query.data?.enabled && <p className="text-xs text-muted-foreground">Next occurrence {new Date(query.data.nextRunAt).toLocaleString()} · {query.data.recentRuns.length} generated</p>}
      {query.data && !query.data.enabled && <p className="text-xs text-muted-foreground">Stopped · previous issues are unchanged.</p>}
      <form className="grid grid-cols-2 gap-2.5" onSubmit={event => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
        <form.Field name="intervalCount" children={field => <Label className="flex flex-col gap-1 text-xs text-muted-foreground">Every
          <Input aria-label="Recurrence interval" name={field.name} type="number" min={1} max={52} step={1} required value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={archived || configure.isPending} />
        </Label>} />
        <form.Field name="unit" children={field => <Label className="flex flex-col gap-1 text-xs text-muted-foreground">Cadence
          <SelectField aria-label="Recurrence cadence" className="w-full" value={field.state.value} onValueChange={value => field.handleChange(value as 'day' | 'week' | 'month')} disabled={archived || configure.isPending} options={[{ value: 'day', label: 'Day(s)' }, { value: 'week', label: 'Week(s)' }, { value: 'month', label: 'Month(s)' }]} />
        </Label>} />
        <form.Field name="timezone" children={field => <Label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">Timezone
          <Input aria-label="Recurrence timezone" name={field.name} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} required maxLength={64} disabled={archived || configure.isPending} />
        </Label>} />
        <form.Field name="nextRunAt" children={field => <Label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">Next occurrence (in selected timezone)
          <Input aria-label="Next occurrence" name={field.name} type="datetime-local" value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} required disabled={archived || configure.isPending} />
        </Label>} />
        <form.Field name="dueDateOffsetDays" children={field => <Label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">Due date offset (days after occurrence; blank for none)
          <Input aria-label="Due date offset" name={field.name} type="number" min={0} max={365} step={1} value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={archived || configure.isPending} />
        </Label>} />
        {dateError && <FieldError role="alert" className="col-span-2 text-xs text-destructive">{dateError}</FieldError>}
        {configure.isError && <FieldError role="alert" className="col-span-2 text-xs text-destructive">{configure.error.message}</FieldError>}
        {stop.isError && <FieldError role="alert" className="col-span-2 text-xs text-destructive">{stop.error.message}</FieldError>}
        {archived && <p className="col-span-2 text-xs text-muted-foreground">Restore this issue to configure future occurrences.</p>}
        <div className="col-span-2 flex justify-end gap-2">
          {query.data?.enabled && <Button type="button" size="sm" variant="outline" aria-label="Stop recurring issue" disabled={stop.isPending || archived} onClick={() => stop.mutate()}>Stop</Button>}
          <form.Subscribe selector={state => state.values} children={values => <Button type="submit" size="sm" disabled={archived || configure.isPending || !values.intervalCount || !values.timezone.trim() || !values.nextRunAt}>{configure.isPending ? 'Saving…' : query.data?.enabled ? 'Update recurrence' : 'Save recurrence'}</Button>} />
        </div>
      </form>
    </>}
  </section>;
}
