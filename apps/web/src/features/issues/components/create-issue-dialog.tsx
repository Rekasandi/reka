import * as React from 'react';
import { useForm } from '@tanstack/react-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from '@reka/ui';
import { useCreateIssue } from '../hooks/use-issues';
import { useProjects } from '../../projects/hooks/use-projects';
import { STATUS_CONFIG } from './status-picker';
import { PriorityIcon } from './issue-list-view';

import { useCycles } from '../../cycles/hooks/use-cycles';
import { useTeams } from '../../teams/hooks/use-teams';

interface CreateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
  defaultCycleId?: string;
  defaultTeamId?: string;
}

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'no_priority', label: 'None' },
] as const;

export function CreateIssueDialog({ open, onOpenChange, defaultProjectId, defaultCycleId, defaultTeamId }: CreateIssueDialogProps) {
  const { data: projects = [] } = useProjects();
  const { data: cycles = [] } = useCycles();
  const { data: teams = [] } = useTeams();
  const createMutation = useCreateIssue();

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      type: 'task',
      projectId: defaultProjectId || 'none',
      cycleId: defaultCycleId || 'none',
      teamId: defaultTeamId || 'none',
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate(
        {
          title: value.title.trim(),
          description: value.description?.trim() || undefined,
          status: value.status,
          priority: value.priority,
          type: value.type,
          projectId: value.projectId === 'none' ? undefined : value.projectId,
          cycleId: value.cycleId === 'none' ? undefined : value.cycleId,
          teamId: value.teamId === 'none' ? undefined : value.teamId,
        },
        {
          onSuccess: () => {
            form.reset();
            onOpenChange(false);
          },
        },
      );
    },
  });

  React.useEffect(() => {
    if (defaultProjectId) {
      form.setFieldValue('projectId', defaultProjectId);
    }
    if (defaultCycleId) {
      form.setFieldValue('cycleId', defaultCycleId);
    }
    if (defaultTeamId) {
      form.setFieldValue('teamId', defaultTeamId);
    }
  }, [defaultProjectId, defaultCycleId, defaultTeamId, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-xl max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>New Issue</DialogTitle>
            <DialogDescription>
              Create a new work item with TanStack Form state and validation.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-1">
            {/* Title Field with TanStack Form */}
            <form.Field
              name="title"
              validators={{
                onChange: ({ value }) => (!value?.trim() ? 'Title is required' : undefined),
              }}
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Title</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder="Issue title"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      autoFocus
                      required
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            />

            {/* Description Field */}
            <form.Field
              name="description"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    placeholder="Add more details, acceptance criteria, or context..."
                    rows={3}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />

            {/* Properties row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Team Select */}
              <form.Field
                name="teamId"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Team</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} className="h-8 text-xs w-full">
                        <SelectValue placeholder="Team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">Default Team (Auto)</SelectItem>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} ({t.key})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {/* Project Select */}
              <form.Field
                name="projectId"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Project</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} className="h-8 text-xs w-full">
                        <SelectValue placeholder="Project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">No Project</SelectItem>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {/* Cycle Select */}
              <form.Field
                name="cycleId"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Cycle</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} className="h-8 text-xs w-full">
                        <SelectValue placeholder="Cycle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">No Cycle</SelectItem>
                          {cycles.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name || `Cycle ${c.number}`} {c.status === 'active' ? '(Active)' : ''}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {/* Status Select */}
              <form.Field
                name="status"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Status</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} className="h-8 text-xs w-full">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <div className="shrink-0">{cfg.renderIcon()}</div>
                                <span>{cfg.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {/* Priority Select */}
              <form.Field
                name="priority"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Priority</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} className="h-8 text-xs w-full">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PRIORITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <PriorityIcon priority={opt.value} />
                                <span>{opt.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {/* Type Select */}
              <form.Field
                name="type"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Type</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} className="h-8 text-xs w-full capitalize">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="feature">Feature</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                          <SelectItem value="bug">Bug</SelectItem>
                          <SelectItem value="improvement">Improvement</SelectItem>
                          <SelectItem value="chore">Chore</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || createMutation.isPending || isSubmitting}
                >
                  {createMutation.isPending || isSubmitting ? 'Creating...' : 'Create Issue'}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
