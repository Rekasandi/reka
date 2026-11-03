import { Input } from '@reka/ui';
import { SelectField } from '../../../components/common/select-field';
import { useTeamFeatures } from '../../teams/hooks/use-team-features';

const NONE = '';

/**
 * Estimate editor that follows the team's scale: a select of valid points for Fibonacci/exponential/linear,
 * or a plain whole-number input for the "free" scale. Renders nothing when the team has estimates disabled.
 * An existing value outside the scale stays selectable so it is never silently lost.
 */
export function EstimatePicker({ teamId, value, onChange, id, ariaLabel = 'Issue estimate', disabled, className }: {
  teamId: string;
  value: number | null;
  onChange: (value: number | null) => void;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { estimatesEnabled, estimateValues } = useTeamFeatures(teamId);
  if (!estimatesEnabled) return null;

  if (!estimateValues) {
    return <Input id={id} type="number" min={0} max={100} step={1} defaultValue={value ?? ''} key={value ?? 'none'} disabled={disabled} aria-label={ariaLabel} placeholder="Points" className={className}
      onBlur={event => {
        const raw = event.target.value;
        if (raw !== '' && (!Number.isInteger(Number(raw)) || Number(raw) < 0 || Number(raw) > 100)) return;
        const next = raw === '' ? null : Number(raw);
        if (next !== value) onChange(next);
      }} />;
  }

  const offScale = value !== null && !estimateValues.includes(value);
  const options = [
    { value: NONE, label: 'No estimate' },
    ...(offScale ? [{ value: String(value), label: `${value} (outside scale)` }] : []),
    ...estimateValues.map(point => ({ value: String(point), label: `${point} ${point === 1 ? 'point' : 'points'}` })),
  ];
  return <SelectField id={id} aria-label={ariaLabel} disabled={disabled} className={className ?? 'w-full'} value={value === null ? NONE : String(value)}
    options={options} placeholder="No estimate" onValueChange={next => onChange(next === NONE ? null : Number(next))} />;
}
