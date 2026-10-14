import { type ReactNode } from 'react';
import type { Issue, Label } from '@reka/types';
import type { Project } from '../../projects/api/projects.api';
import type { User } from '../../users/api/users.api';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@reka/ui';
import { FolderKanban, Triangle, Users, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { IssueFilters } from '../lib/issue-filters';
import { PriorityIcon } from './priority-picker';

export type FilterCategory = 'assignees' | 'labels' | 'priority' | 'projects';

interface IssueFiltersSidebarProps {
  issues: Issue[];
  users: User[];
  labels: Label[];
  labelsLoading?: boolean;
  projects: Project[];
  filters: IssueFilters;
  category: FilterCategory;
  onCategoryChange: (category: FilterCategory) => void;
  onToggle: (field: keyof IssueFilters, id: string) => void;
  onClear: () => void;
}

const priorities = [
  { id: 'urgent', name: 'Urgent' },
  { id: 'high', name: 'High' },
  { id: 'medium', name: 'Medium' },
  { id: 'low', name: 'Low' },
  { id: 'no_priority', name: 'No priority' },
];

function countFor(issues: Issue[], predicate: (issue: Issue) => boolean) {
  return issues.filter(predicate).length;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function FilterOption({
  name,
  count,
  checked,
  onChange,
  icon,
}: {
  name: string;
  count: number;
  checked: boolean;
  onChange: () => void;
  icon?: ReactNode;
}) {
  return (
    <Button
      variant={checked ? 'secondary' : 'ghost'}
      aria-pressed={checked}
      onClick={onChange}
      className="h-12 w-full justify-start gap-2.5 px-2"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{name}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <Triangle aria-hidden="true" />
        <span className="tabular-nums">{count}</span>
      </span>
    </Button>
  );
}

export function IssueFiltersSidebar({
  issues,
  users,
  labels,
  labelsLoading = false,
  projects,
  filters,
  category,
  onCategoryChange,
  onToggle,
  onClear,
}: IssueFiltersSidebarProps) {
  const activeCount = filters.assigneeIds.length + filters.labelIds.length + filters.priorities.length + filters.projectIds.length;
  const assignees = [
    { id: 'unassigned', name: 'No assignee', avatarUrl: null },
    ...users.map((user) => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl })),
  ];
  const labelOptions = labels.map((label) => ({ id: label.id, name: label.name, color: label.color }));
  const projectOptions = [
    { id: 'unassigned', name: 'No project' },
    ...projects.map((project) => ({ id: project.id, name: project.name })),
  ];

  return (
    <section aria-label="Issue filters" className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
      {activeCount > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
          <Badge variant="secondary">{activeCount} selected</Badge>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X data-icon="inline-start" />
            Clear
          </Button>
        </div>
      )}

      <Tabs value={category} onValueChange={(value) => onCategoryChange(value as FilterCategory)} className="min-h-0 flex-1 flex-col">
        <TabsList variant="line" className="grid h-9 w-full shrink-0 grid-cols-4 gap-1.5">
          {(['assignees', 'labels', 'priority', 'projects'] as const).map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className={cn(
                'min-w-0 rounded-full border border-border px-1 text-xs after:hidden',
                category === value ? 'bg-accent' : 'bg-muted/50',
              )}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2">
          <TabsContent value="assignees" className="mt-2">
            <div className="flex flex-col gap-0.5">
              {assignees.map((assignee) => {
                const user = users.find((item) => item.id === assignee.id);
                const count = countFor(issues, (issue) => (issue.assigneeId || 'unassigned') === assignee.id);
                return (
                  <FilterOption
                    key={assignee.id}
                    name={assignee.name}
                    count={count}
                    checked={filters.assigneeIds.includes(assignee.id)}
                    onChange={() => onToggle('assigneeIds', assignee.id)}
                    icon={(
                      <Avatar size="sm" className="size-5">
                        {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                        <AvatarFallback>{user ? initials(user.name) : <Users />}</AvatarFallback>
                      </Avatar>
                    )}
                  />
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="labels" className="mt-2">
            {labelsLoading ? (
              <div className="flex flex-col gap-2 px-2 py-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : labelOptions.length ? (
              <div className="flex flex-col gap-0.5">
                {labelOptions.map((label) => (
                  <FilterOption
                    key={label.id}
                    name={label.name}
                    count={countFor(issues, (issue) => Boolean(issue.labels?.some((item) => item.id === label.id)))}
                    checked={filters.labelIds.includes(label.id)}
                    onChange={() => onToggle('labelIds', label.id)}
                    icon={<span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: label.color }} />}
                  />
                ))}
              </div>
            ) : (
              <p className="px-2 py-4 text-sm text-muted-foreground">No labels available.</p>
            )}
          </TabsContent>

          <TabsContent value="priority" className="mt-2">
            <div className="flex flex-col gap-0.5">
              {priorities.map((priority) => (
                <FilterOption
                  key={priority.id}
                  name={priority.name}
                  count={countFor(issues, (issue) => issue.priority === priority.id)}
                  checked={filters.priorities.includes(priority.id)}
                  onChange={() => onToggle('priorities', priority.id)}
                  icon={<PriorityIcon priority={priority.id} />}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="projects" className="mt-2">
            <div className="flex flex-col gap-0.5">
              {projectOptions.map((project) => (
                <FilterOption
                  key={project.id}
                  name={project.name}
                  count={countFor(issues, (issue) => (issue.projectId || 'unassigned') === project.id)}
                  checked={filters.projectIds.includes(project.id)}
                  onChange={() => onToggle('projectIds', project.id)}
                  icon={<FolderKanban className="size-4 shrink-0 text-muted-foreground" />}
                />
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>

    </section>
  );
}
