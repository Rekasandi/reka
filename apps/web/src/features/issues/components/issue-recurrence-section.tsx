import * as React from 'react';
import { Alert, AlertDescription, Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@reka/ui';
import { Repeat2 } from 'lucide-react';
import { useConfigureIssueRecurrence, useIssueRecurrence, useStopIssueRecurrence } from '../hooks/use-issue-recurrence';
import { formatDateTimeInZone, parseDateTimeInZone } from '../lib/recurrence-date';

const defaultTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function IssueRecurrenceSection({ issueId, archived = false }: { issueId: string; archived?: boolean }) {
  const query = useIssueRecurrence(issueId);
  const configure = useConfigureIssueRecurrence(issueId);
  const stop = useStopIssueRecurrence(issueId);
  const [intervalCount, setIntervalCount] = React.useState('1');
  const [unit, setUnit] = React.useState<'day' | 'week' | 'month'>('week');
  const [timezone, setTimezone] = React.useState(defaultTimezone);
  const [nextRunAt, setNextRunAt] = React.useState(() => formatDateTimeInZone(new Date(Date.now() + 86_400_000), defaultTimezone()));
  const [dueDateOffsetDays, setDueDateOffsetDays] = React.useState('');
  const [dateError, setDateError] = React.useState('');

  React.useEffect(() => {
    const recurrence = query.data;
    if (recurrence) {
      setIntervalCount(String(recurrence.intervalCount));
      setUnit(recurrence.unit);
      setTimezone(recurrence.timezone);
      setNextRunAt(formatDateTimeInZone(recurrence.nextRunAt, recurrence.timezone));
      setDueDateOffsetDays(recurrence.template.dueDateOffsetDays == null ? '' : String(recurrence.template.dueDateOffsetDays));
    } else if (query.isSuccess) {
      const zone = defaultTimezone();
      setTimezone(zone);
      setNextRunAt(formatDateTimeInZone(new Date(Date.now() + 86_400_000), zone));
    }
  }, [query.data, query.isSuccess]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setDateError('');
    try {
      configure.mutate({
        intervalCount: Number(intervalCount), unit, timezone: timezone.trim(), nextRunAt: parseDateTimeInZone(nextRunAt, timezone.trim()),
        dueDateOffsetDays: dueDateOffsetDays === '' ? null : Number(dueDateOffsetDays),
      });
    } catch (error) { setDateError((error as Error).message); }
  };

  return <section aria-label="Issue recurrence" className="flex min-w-0 flex-col gap-3">
    <div className="flex items-center gap-2"><Repeat2 className="size-3.5 text-muted-foreground" /><h3 className="text-xs font-medium">Recurring issue</h3></div>
    {query.isLoading ? <p role="status" className="text-xs text-muted-foreground">Loading recurrence…</p> : null}
    {query.isError ? <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-2">Could not load recurrence: {query.error.message}<Button type="button" size="xs" variant="outline" onClick={() => void query.refetch()}>Retry</Button></AlertDescription></Alert> : null}
    {query.isSuccess && <>
      {query.data?.enabled && <p className="text-xs text-muted-foreground">Next occurrence {new Date(query.data.nextRunAt).toLocaleString()} · {query.data.recentRuns.length} generated</p>}
      {query.data && !query.data.enabled && <p className="text-xs text-muted-foreground">Stopped · previous issues are unchanged.</p>}
      <form className="grid grid-cols-2 gap-2.5" onSubmit={submit}>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Every
          <Input aria-label="Recurrence interval" type="number" min={1} max={52} step={1} required value={intervalCount} onChange={event => setIntervalCount(event.target.value)} disabled={archived || configure.isPending} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Cadence
          <Select value={unit} onValueChange={value => setUnit(value as typeof unit)} disabled={archived || configure.isPending}>
            <SelectTrigger aria-label="Recurrence cadence" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="day">Day(s)</SelectItem><SelectItem value="week">Week(s)</SelectItem><SelectItem value="month">Month(s)</SelectItem></SelectGroup></SelectContent>
          </Select>
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">Timezone
          <Input aria-label="Recurrence timezone" value={timezone} onChange={event => setTimezone(event.target.value)} required maxLength={64} disabled={archived || configure.isPending} />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">Next occurrence (in selected timezone)
          <Input aria-label="Next occurrence" type="datetime-local" value={nextRunAt} onChange={event => setNextRunAt(event.target.value)} required disabled={archived || configure.isPending} />
        </label>
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">Due date offset (days after occurrence; blank for none)
          <Input aria-label="Due date offset" type="number" min={0} max={365} step={1} value={dueDateOffsetDays} onChange={event => setDueDateOffsetDays(event.target.value)} disabled={archived || configure.isPending} />
        </label>
        {dateError && <p role="alert" className="col-span-2 text-xs text-destructive">{dateError}</p>}
        {configure.isError && <p role="alert" className="col-span-2 text-xs text-destructive">{configure.error.message}</p>}
        {stop.isError && <p role="alert" className="col-span-2 text-xs text-destructive">{stop.error.message}</p>}
        {archived && <p className="col-span-2 text-xs text-muted-foreground">Restore this issue to configure future occurrences.</p>}
        <div className="col-span-2 flex justify-end gap-2">
          {query.data?.enabled && <Button type="button" size="sm" variant="outline" aria-label="Stop recurring issue" disabled={stop.isPending || archived} onClick={() => stop.mutate()}>Stop</Button>}
          <Button type="submit" size="sm" disabled={archived || configure.isPending || !intervalCount || !timezone.trim() || !nextRunAt}>{configure.isPending ? 'Saving…' : query.data?.enabled ? 'Update recurrence' : 'Save recurrence'}</Button>
        </div>
      </form>
    </>}
  </section>;
}
