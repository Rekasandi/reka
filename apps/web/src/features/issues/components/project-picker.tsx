import { FolderKanban } from 'lucide-react';
import {
  Badge, cn, DropdownMenu, DropdownMenuTrigger,
  DropdownMenuGroup, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@reka/ui';
import { useProjects } from '../../projects/hooks/use-projects';
import { IssuePickerMenu } from './issue-picker-menu';

export function ProjectPicker({ projectId, onProjectChange, identifier, compact = false, className, id }: {
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  identifier?: string;
  compact?: boolean;
  className?: string;
  id?: string;
}) {
  const { data: projects = [], isPending, isError, refetch } = useProjects();
  const items = [{ id: 'none', label: 'No project' }, ...projects.map(project => ({ id: project.id, label: project.name }))];
  const label = items.find(item => item.id === (projectId ?? 'none'))?.label ?? 'Project unavailable';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={event => event.stopPropagation()}>
        <Badge asChild variant="success" className={cn('h-6 gap-1.5 px-1.5 sm:px-2 hover:bg-success/15', className)}>
          <button type="button" id={id} disabled={isPending}
            aria-label={`Change project${identifier ? ` for ${identifier}` : ''}: ${label}`} title={`Change project: ${label}`}>
            <FolderKanban className="size-3.5 shrink-0" />
            <span className={cn('max-w-[160px] truncate', compact && 'hidden md:inline')}>{label}</span>
          </button>
        </Badge>
      </DropdownMenuTrigger>
      <IssuePickerMenu label="Projects">
        {search => {
          if (isError) return <DropdownMenuGroup><DropdownMenuItem onSelect={event => { event.preventDefault(); void refetch(); }}>Failed to load projects. Retry</DropdownMenuItem></DropdownMenuGroup>;
          const filtered = items.filter(item => item.label.toLowerCase().includes(search));
          return filtered.length ? <DropdownMenuRadioGroup value={projectId ?? 'none'} onValueChange={value => {
            const nextId = value === 'none' ? null : value;
            if (nextId !== projectId) onProjectChange(nextId);
          }}>
            {filtered.map(item => <DropdownMenuRadioItem key={item.id} value={item.id} indicatorPosition="right" className="py-1.5">
              <FolderKanban className="size-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span>
            </DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup> : <p role="status" className="p-3 text-center text-xs text-muted-foreground">No projects found.</p>;
        }}
      </IssuePickerMenu>
    </DropdownMenu>
  );
}
