import * as React from 'react';
import type { IssueType } from '@reka/types';
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
import { ProjectPicker } from './project-picker';
import { CyclePicker } from './cycle-picker';
import { StatusPicker } from './status-picker';
import { PriorityPicker } from './priority-picker';
import { IssueTypePicker } from './issue-type-picker';
import { IssueLabelsPicker } from './issue-labels-picker';

import { useTeams } from '../../teams/hooks/use-teams';
import { useUsers } from '../../users/hooks/use-users';

interface CreateIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
  defaultCycleId?: string;
  defaultTeamId?: string;
  defaultStatus?: string;
  defaultParentId?: string;
  defaultParentIdentifier?: string;
}

export function CreateIssueDialog({ open, onOpenChange, defaultProjectId, defaultCycleId, defaultTeamId, defaultStatus, defaultParentId, defaultParentIdentifier }: CreateIssueDialogProps) {
  const { data: teams = [] } = useTeams();
  const { data: users = [] } = useUsers();
  const createMutation = useCreateIssue();

  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      status: defaultStatus || 'todo',
      priority: 'medium',
      type: 'task' as IssueType,
      assigneeId: 'none',
      projectId: defaultProjectId || 'none',
      cycleId: defaultCycleId || 'none',
      teamId: defaultTeamId || '',
      parentId: defaultParentId || '',
      estimate: '',
      dueDate: '',
      labelIds: [] as string[],
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate(
        {
          title: value.title.trim(),
          description: value.description?.trim() || undefined,
          status: value.status,
          priority: value.priority,
          type: value.type,
          assigneeId: value.assigneeId === 'none' ? null : value.assigneeId,
          projectId: value.projectId === 'none' ? undefined : value.projectId,
          cycleId: value.cycleId === 'none' ? undefined : value.cycleId,
          teamId: value.teamId,
          parentId: value.parentId || undefined,
          estimate: value.estimate === '' ? null : Number(value.estimate),
          dueDate: value.dueDate || null,
          labelIds: value.labelIds,
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
    if (defaultStatus) {
      form.setFieldValue('status', defaultStatus);
    }
    if (defaultProjectId) {
      form.setFieldValue('projectId', defaultProjectId);
    }
    if (defaultCycleId) {
      form.setFieldValue('cycleId', defaultCycleId);
    }
    if (defaultTeamId) {
      form.setFieldValue('teamId', defaultTeamId);
    } else if (!form.state.values.teamId && teams[0]) {
      form.setFieldValue('teamId', teams[0].id);
    }
    if (defaultParentId) {
      form.setFieldValue('parentId', defaultParentId);
    }
  }, [open, defaultStatus, defaultProjectId, defaultCycleId, defaultTeamId, defaultParentId, form, teams]);

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
            <DialogTitle>{defaultParentId ? 'New Sub-issue' : 'New Issue'}</DialogTitle>
            <DialogDescription>
              {defaultParentId
                ? `Add a child issue to ${defaultParentIdentifier ?? 'this issue'}.`
                : 'Start in the team backlog, then optionally link this issue to a project or cycle.'}
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
                validators={{ onChange: ({ value }) => (!value ? 'Team is required' : undefined) }}
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Team</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={teamId => {
                        if (teamId !== field.state.value) form.setFieldValue('cycleId', 'none');
                        field.handleChange(teamId);
                      }}
                    >
                      <SelectTrigger id={field.name} size="compact" className="w-full">
                        <SelectValue placeholder="Team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
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
                    <ProjectPicker id={field.name} projectId={field.state.value === 'none' ? null : field.state.value} className="h-8 w-full justify-start" onProjectChange={projectId => field.handleChange(projectId ?? 'none')} />
                  </Field>
                )}
              />

              {/* Cycle Select */}
              <form.Field
                name="cycleId"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Cycle</FieldLabel>
                    <form.Subscribe selector={state => state.values.teamId} children={teamId => (
                      <CyclePicker id={field.name} cycleId={field.state.value === 'none' ? null : field.state.value} teamId={teamId} className="h-8 w-full justify-start" onCycleChange={cycleId => field.handleChange(cycleId ?? 'none')} />
                    )} />
                  </Field>
                )}
              />

              {/* Status Select */}
              <form.Field
                name="status"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Status</FieldLabel>
                    <form.Subscribe selector={state => state.values.teamId} children={teamId => <StatusPicker id={field.name} teamId={teamId} status={field.state.value} appearance="badge" className="h-8 w-full justify-start" onStatusChange={field.handleChange} />} />
                  </Field>
                )}
              />

              {/* Priority Select */}
              <form.Field
                name="priority"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Priority</FieldLabel>
                    <PriorityPicker id={field.name} priority={field.state.value} appearance="badge" className="h-8 w-full justify-start" onPriorityChange={field.handleChange} />
                  </Field>
                )}
              />

              {/* Type Select */}
              <form.Field
                name="type"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Type</FieldLabel>
                    <IssueTypePicker id={field.name} type={field.state.value} className="h-8 w-full justify-start" onTypeChange={field.handleChange} />
                  </Field>
                )}
              />
              {/* Assignee Select */}
              <form.Field
                name="assigneeId"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Assignee</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} size="compact" className="w-full">
                        <SelectValue placeholder="Assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <form.Field
                name="estimate"
                validators={{ onChange: ({ value }) => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 100) ? 'Use a whole number from 0 to 100' : undefined }}
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Estimate</FieldLabel>
                    <Input id={field.name} name={field.name} type="number" min={0} max={100} step={1} value={field.state.value} onBlur={field.handleBlur} onChange={(event) => field.handleChange(event.target.value)} placeholder="Points" />
                  </Field>
                )}
              />
              <form.Field
                name="dueDate"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Due date</FieldLabel>
                    <Input id={field.name} name={field.name} type="date" value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                  </Field>
                )}
              />
            </div>
            <form.Subscribe selector={state => ({ teamId: state.values.teamId, projectId: state.values.projectId, labelIds: state.values.labelIds })}>
              {({ teamId, projectId, labelIds }) => teamId ? <IssueLabelsPicker teamId={teamId} projectId={projectId === 'none' ? null : projectId} value={labelIds} onChange={ids => form.setFieldValue('labelIds', ids)} /> : null}
            </form.Subscribe>
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
                  {createMutation.isPending || isSubmitting ? 'Creating...' : defaultParentId ? 'Create Sub-issue' : 'Create Issue'}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
