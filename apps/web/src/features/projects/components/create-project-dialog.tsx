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
  DatePicker,
} from '@reka/ui';
import { useCreateProject } from '../hooks/use-projects';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const createMutation = useCreateProject();

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      status: 'in_progress',
      health: 'on_track',
      targetDate: '',
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate(
        {
          name: value.name.trim(),
          description: value.description?.trim() || undefined,
          status: value.status,
          health: value.health,
          targetDate: value.targetDate || undefined,
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
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Create a cross-functional project stream to organize and track issues.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-1">
            {/* Project Name Field */}
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => (!value?.trim() ? 'Project name is required' : undefined),
              }}
              children={(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Project Name</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder="e.g. Mobile App V2, Design System..."
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
                    placeholder="What is this project delivering?"
                    rows={3}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Status Field */}
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
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="canceled">Canceled</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {/* Health Field */}
              <form.Field
                name="health"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Health</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.state.value}
                      onValueChange={field.handleChange}
                    >
                      <SelectTrigger id={field.name} className="h-8 text-xs w-full">
                        <SelectValue placeholder="Health" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="on_track">On Track</SelectItem>
                          <SelectItem value="at_risk">At Risk</SelectItem>
                          <SelectItem value="off_track">Off Track</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />

              {/* Target Date Field with DatePicker button */}
              <form.Field
                name="targetDate"
                children={(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name} className="text-muted-foreground">Target Date</FieldLabel>
                    <DatePicker
                      date={field.state.value ? new Date(field.state.value) : undefined}
                      onDateChange={(selected) => {
                        field.handleChange(selected ? selected.toISOString() : '');
                      }}
                      placeholder="Select target date"
                    />
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
                  {createMutation.isPending || isSubmitting ? 'Creating...' : 'Create Project'}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
