const dateTimeFormatter = (timeZone: string) => new Intl.DateTimeFormat('en-CA', {
  timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function formatDateTimeInZone(value: Date | string, timeZone: string) {
  const parts = Object.fromEntries(dateTimeFormatter(timeZone).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function parseDateTimeInZone(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Choose a valid next occurrence date and time.');
  const [, year, month, day, hour, minute] = match;
  const wallTime = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let instant = wallTime;
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = formatDateTimeInZone(new Date(instant), timeZone);
    const actualMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(actual)!;
    const actualWallTime = Date.UTC(Number(actualMatch[1]), Number(actualMatch[2]) - 1, Number(actualMatch[3]), Number(actualMatch[4]), Number(actualMatch[5]));
    instant += wallTime - actualWallTime;
  }
  if (formatDateTimeInZone(new Date(instant), timeZone) !== value) throw new Error('That local time does not exist in this timezone because of a clock change.');
  return new Date(instant).toISOString();
}
