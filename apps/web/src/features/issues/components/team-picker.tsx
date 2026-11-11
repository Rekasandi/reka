import { Users } from 'lucide-react';
import { Badge, cn, DropdownMenu, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, Button, FieldDescription } from '@reka/ui';
import { IssuePickerMenu } from './issue-picker-menu';

type PickerTeam = { id: string; name: string; key: string };

const TeamKey = ({ team }: { team: PickerTeam }) => <span aria-hidden="true" className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-sm border border-border bg-muted px-0.5 font-mono text-2xs font-semibold text-muted-foreground">{team.key}</span>;

/** Searchable team menu, same surface as the project/status/priority pickers. Callers pass the teams the user may pick. */
export function TeamPicker({ teams, teamId, onTeamChange, id, label = 'Team', placeholder = 'Choose team', disabled, className }: {
  teams: PickerTeam[];
  teamId: string;
  onTeamChange: (teamId: string) => void;
  id?: string;
  /** Accessible name prefix, e.g. "Route to team". */
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const selected = teams.find(team => team.id === teamId);
  const text = selected?.name ?? placeholder;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={event => event.stopPropagation()}>
        <Badge asChild variant="outline" className={cn('h-6 gap-1.5 px-2 hover:bg-secondary/70', className)}>
          <Button variant="plain" size="auto" type="button" id={id} disabled={disabled} aria-label={`${label}: ${text}`} title={`${label}: ${text}`}>
            {selected ? <TeamKey team={selected} /> : <Users className="size-3.5 shrink-0" />}
            <span className={cn('min-w-0 truncate', !selected && 'text-muted-foreground')}>{text}</span>
          </Button>
        </Badge>
      </DropdownMenuTrigger>
      <IssuePickerMenu label="Teams">
        {search => {
          const filtered = teams.filter(team => `${team.name} ${team.key}`.toLowerCase().includes(search));
          return filtered.length ? <DropdownMenuRadioGroup value={teamId} onValueChange={value => { if (value !== teamId) onTeamChange(value); }}>
            {filtered.map(team => <DropdownMenuRadioItem key={team.id} value={team.id} indicatorPosition="right" className="py-1.5">
              <TeamKey team={team} /><span className="min-w-0 flex-1 truncate">{team.name}</span>
            </DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup> : <FieldDescription role="status" className="p-3 text-center text-xs text-muted-foreground">No teams found.</FieldDescription>;
        }}
      </IssuePickerMenu>
    </DropdownMenu>
  );
}
