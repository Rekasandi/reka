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
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from '@reka/ui';
import { useCreateIssue } from '../hooks/use-issues';
import { ProjectPicker } from './project-picker';
import { TeamPicker } from './team-picker';
import { LazyNotionEditor } from '../../../components/editor/lazy-notion-editor';
import { CyclePicker } from './cycle-picker';
import { EstimatePicker } from './estimate-picker';
import { AssigneePicker } from './assignee-picker';
import { TeamFeatureGate } from '../../teams/components/team-feature-gate';
import { StatusPicker } from './status-picker';
import { PriorityPicker } from './priority-picker';
import { IssueTypePicker } from './issue-type-picker';
import { IssueLabelsPicker } from './issue-labels-picker';

import { useTeams } from '../../teams/hooks/use-teams';

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

  // The team's configured default status (Team settings → Status automation), else Todo.
  const teamDefaultStatus = (teamId: string) => teams.find(team => team.id === teamId)?.defaultStatus ?? 'todo';
  React.useEffect(() => {
    if (defaultStatus) {
      form.setFieldValue('status', defaultStatus);
    } else if (!form.getFieldMeta('status')?.isTouched) {
      form.setFieldValue('status', teamDefaultStatus(defaultTeamId || form.state.values.teamId || teams[0]?.id || ''), { dontUpdateMeta: true });
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
                  <LazyNotionEditor
                    id={field.name}
                    aria-label="Description"
                    defaultValue={field.state.value}
                    changeDelay={0}
                    compact
                    placeholder="Add details, acceptance criteria, or context… Type '/' for blocks"
                    onChange={field.handleChange}
                    onBlur={() => field.handleBlur()}
                    className="min-h-20 rounded-md border border-input dark:bg-input/30"
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
                    <TeamPicker id={field.name} teams={teams} teamId={field.state.value} className="h-8 w-full justify-start"
                      onTeamChange={teamId => { form.setFieldValue('cycleId', 'none'); form.setFieldValue('estimate', ''); if (!form.getFieldMeta('status')?.isTouched) form.setFieldValue('status', teamDefaultStatus(teamId), { dontUpdateMeta: true }); field.handleChange(teamId); }} />
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
                  <form.Subscribe selector={state => state.values.teamId} children={teamId => (
                    <TeamFeatureGate teamId={teamId} feature="cycles">
                      <Field>
                        <FieldLabel htmlFor={field.name} className="text-muted-foreground">Cycle</FieldLabel>
                        <CyclePicker id={field.name} cycleId={field.state.value === 'none' ? null : field.state.value} teamId={teamId} className="h-8 w-full justify-start" onCycleChange={cycleId => field.handleChange(cycleId ?? 'none')} />
                      </Field>
                    </TeamFeatureGate>
                  )} />
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
                    <AssigneePicker
                      id={field.name}
                      assigneeId={field.state.value === 'none' || !field.state.value ? null : field.state.value}
                      appearance="badge"
                      className="h-8 w-full justify-start"
                      onAssigneeChange={(userId) => field.handleChange(userId ?? 'none')}
                    />
                  </Field>
                )}
              />
              <form.Field
                name="estimate"
                validators={{ onChange: ({ value }) => value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 100) ? 'Use a whole number from 0 to 100' : undefined }}
                children={(field) => (
                  <form.Subscribe selector={state => state.values.teamId} children={teamId => teamId ? (
                    <TeamFeatureGate teamId={teamId} feature="estimates">
                      <Field>
                        <FieldLabel htmlFor={field.name} className="text-muted-foreground">Estimate</FieldLabel>
                        <EstimatePicker id={field.name} ariaLabel="Estimate" teamId={teamId} value={field.state.value === '' ? null : Number(field.state.value)} onChange={points => field.handleChange(points === null ? '' : String(points))} />
                      </Field>
                    </TeamFeatureGate>
                  ) : null} />
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
