import * as React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@reka/ui';

/** Radix Select cannot hold an empty-string value, so "no selection" options use this sentinel internally. */
const EMPTY = '__empty__';

export interface SelectFieldOption { value: string; label: React.ReactNode; disabled?: boolean }

export interface SelectFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectFieldOption[];
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  /** Applied to the trigger. Triggers are `w-fit` by default; pass `w-full` to fill the container. */
  className?: string;
  size?: 'sm' | 'default' | 'compact';
}

/**
 * Thin wrapper over the shadcn/Radix `Select` for option-list fields.
 * An option with `value: ''` is supported (e.g. "All teams" / "No project").
 */
export function SelectField({ value, onValueChange, options, placeholder, className, size = 'compact', ...props }: SelectFieldProps) {
  // With no explicit '' option, an empty value shows the placeholder (Radix treats '' as "nothing selected").
  const hasEmptyOption = options.some(option => option.value === '');
  const encode = (v: string) => (v === '' && hasEmptyOption ? EMPTY : v);
  return (
    <Select value={encode(value)} onValueChange={next => {
      // Radix never emits '' for a real option (empty selections use the sentinel); the hidden form <select> can emit it while options are unmounted.
      if (next === '') return;
      onValueChange(next === EMPTY ? '' : next);
    }} name={props.name} disabled={props.disabled} required={props.required}>
      <SelectTrigger id={props.id} aria-label={props['aria-label']} size={size} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(option => <SelectItem key={option.value} value={encode(option.value)} disabled={option.disabled}>{option.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
