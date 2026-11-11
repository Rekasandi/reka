import * as React from 'react';
import { Badge, Button, cn, DropdownMenu, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuShortcut, DropdownMenuTrigger, FieldDescription } from '@reka/ui';
import { IssuePickerMenu } from '../../features/issues/components/issue-picker-menu';

type IconComponent = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
/** `leading` (e.g. an avatar) replaces the icon when given. */
export type PropertyOption<T extends string> = { key: T; label: string; hint?: string; icon?: IconComponent; leading?: React.ReactNode; color?: string; disabled?: boolean };

const Leading = ({ option }: { option: { icon?: IconComponent; leading?: React.ReactNode; color?: string } }) => {
  if (option.leading) return <>{option.leading}</>;
  const Icon = option.icon;
  return Icon ? <Icon aria-hidden="true" className={cn('size-3.5 shrink-0', option.color ?? 'text-muted-foreground')} /> : null;
};

/**
 * Inline property editor for table rows: an outline badge that opens the shared searchable menu
 * (same surface as the issue status picker) with icons and 1–9 shortcuts. Without `onChange` it is a plain badge.
 */
export function PropertyPicker<T extends string>({ value, options, menuLabel, ariaLabel, onChange, disabled, describedBy, placeholder = 'None', shortcuts = true, placeholderIcon }: {
  value: string;
  options: PropertyOption<T>[];
  /** Menu heading and search placeholder, e.g. "Role". */
  menuLabel: string;
  /** Accessible name prefix for the trigger, e.g. "Role for Ayu". The current value is appended. */
  ariaLabel: string;
  onChange?: (value: T) => void;
  disabled?: boolean;
  describedBy?: string;
  /** Text when the value matches no option. */
  placeholder?: string;
  placeholderIcon?: IconComponent;
  /** Number keys 1–9 pick options; turn off for long lists such as people. */
  shortcuts?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find(option => option.key === value);
  const text = current?.label ?? placeholder;
  const content = <><Leading option={current ?? { icon: placeholderIcon }} /><span className={cn('max-w-40 truncate', !current && 'text-muted-foreground')}>{text}</span></>;

  if (!onChange) return <Badge variant="outline" className="h-6 gap-1.5 px-2">{content}</Badge>;

  const numbered = options.map((option, index) => ({ ...option, number: index + 1 }));
  const choose = (next: string) => { if (next !== value) onChange(next as T); setOpen(false); };
  const handleShortcut = (event: React.KeyboardEvent) => {
    if (!shortcuts || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    const option = numbered.find(item => String(item.number) === event.key && !item.disabled);
    if (!option) return;
    event.preventDefault();
    event.stopPropagation();
    choose(option.key);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild onClick={event => event.stopPropagation()}>
        <Badge asChild variant="outline" className="h-6 gap-1.5 px-2 hover:bg-secondary/70">
          <Button variant="plain" size="auto" type="button" disabled={disabled} aria-label={`${ariaLabel}: ${text}`} aria-describedby={describedBy} title={`Change ${menuLabel.toLowerCase()}`} onKeyDown={handleShortcut}>
            {content}
          </Button>
        </Badge>
      </DropdownMenuTrigger>
      <IssuePickerMenu label={menuLabel} onKeyDown={handleShortcut}>
        {search => {
          const items = numbered.filter(item => `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(search));
          if (!items.length) return <FieldDescription role="status" className="p-3 text-center text-xs text-muted-foreground">No {menuLabel.toLowerCase()}s found.</FieldDescription>;
          return <DropdownMenuRadioGroup value={value} onValueChange={choose}>
            {items.map(item => <DropdownMenuRadioItem key={item.key} value={item.key} disabled={item.disabled} aria-keyshortcuts={shortcuts ? String(item.number) : undefined} indicatorPosition={shortcuts ? 'before-shortcut' : 'right'} className="py-1.5">
              <Leading option={item} />
              <span className="min-w-0 flex-1 truncate">{item.label}{item.hint && <span className="ml-1.5 text-xs text-muted-foreground">{item.hint}</span>}</span>
              {shortcuts && <DropdownMenuShortcut aria-hidden="true" className="ml-7 w-3 text-center">{item.number}</DropdownMenuShortcut>}
            </DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>;
        }}
      </IssuePickerMenu>
    </DropdownMenu>
  );
}
