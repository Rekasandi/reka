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
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
  DatePicker,
} from '@reka/ui';
import { useCreateCycle } from '../hooks/use-cycles';

interface CreateCycleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCycleDialog({ open, onOpenChange }: CreateCycleDialogProps) {
  const createMutation = useCreateCycle();

  const defaultStart = new Date();
  const defaultEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 2 weeks sprint

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      startDate: defaultStart.toISOString(),
      endDate: defaultEnd.toISOString(),
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate(
        {
          name: value.name?.trim() || undefined,
          description: value.description?.trim() || undefined,
          startDate: value.startDate,
          endDate: value.endDate,
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
      <DialogContent className="w-full sm:max-w-lg max-w-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>New Cycle</DialogTitle>
            <DialogDescription>
              Create a time-boxed sprint to focus your team on delivering work items.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-1">
            <form.Field
              name="name"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Cycle Name (Optional)</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder="e.g. Cycle 25 (Sprint Alpha)..."
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    autoFocus
                  />
                </Field>
              )}
            />

            <form.Field
              name="description"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Cycle Goals</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    placeholder="Key deliverables and objectives for this cycle..."
                    rows={2}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <form.Field
                name="startDate"
                validators={{
                  onChange: ({ value }) => (!value ? 'Start date is required' : undefined),
                }}
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name} className="text-muted-foreground">Start Date</FieldLabel>
                      <DatePicker
                        date={field.state.value ? new Date(field.state.value) : undefined}
                        onDateChange={(selected) => {
                          field.handleChange(selected ? selected.toISOString() : '');
                        }}
                        placeholder="Pick start date"
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              />

              <form.Field
                name="endDate"
                validators={{
                  onChange: ({ value }) => (!value ? 'End date is required' : undefined),
                }}
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name} className="text-muted-foreground">End Date</FieldLabel>
                      <DatePicker
                        date={field.state.value ? new Date(field.state.value) : undefined}
                        onDateChange={(selected) => {
                          field.handleChange(selected ? selected.toISOString() : '');
                        }}
                        placeholder="Pick end date"
                      />
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
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
                  {createMutation.isPending || isSubmitting ? 'Creating...' : 'Create Cycle'}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
