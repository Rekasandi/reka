import {
  BriefcaseBusiness, Boxes, Building2, Check, CodeXml, Folder, FolderKanban,
  Layers3, Rocket, Target, Users, Users2, UsersRound, Workflow, Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { EntityIconName } from '@reka/types';
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@reka/ui';

const ENTITY_ICONS: Record<EntityIconName, ComponentType<{ className?: string }>> = {
  FolderKanban,
  Folder,
  BriefcaseBusiness,
  Rocket,
  Layers3,
  CodeXml,
  Users,
  UsersRound,
  Users2,
  Zap,
  Target,
  Boxes,
  Workflow,
  Building2,
};

export function resolveEntityIcon(icon?: EntityIconName | null) {
  return (icon && ENTITY_ICONS[icon]) || FolderKanban;
}

export function EntityIconPicker({
  icon,
  label,
  onChange,
  size = 'sm',
}: {
  icon?: EntityIconName | null;
  label: string;
  size?: 'sm' | 'lg';
  onChange: (icon: EntityIconName) => void;
}) {
  const SelectedIcon = resolveEntityIcon(icon);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Change ${label} icon`}
          title={`Change ${label} icon`}
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-lg border border-border/70 bg-secondary text-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            size === 'lg' ? 'size-12' : 'size-8',
          )}
        >
          <SelectedIcon className={size === 'lg' ? 'size-6' : 'size-4'} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>{label} icon</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={icon ?? 'FolderKanban'} onValueChange={(value) => onChange(value as EntityIconName)}>
          {Object.entries(ENTITY_ICONS).map(([name, Icon]) => (
            <DropdownMenuRadioItem key={name} value={name}>
              <Icon className="size-4 text-muted-foreground" />
              <span>{name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')}</span>
              {icon === name && <Check className="ml-auto size-3.5" />}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
