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
  FieldDescription,
  FieldGroup,
} from '@reka/ui';
import { useCreateTeam } from '../hooks/use-teams';

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTeamDialog({ open, onOpenChange }: CreateTeamDialogProps) {
  const createMutation = useCreateTeam();

  const form = useForm({
    defaultValues: {
      name: '',
      key: '',
      description: '',
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate(
        {
          name: value.name.trim(),
          key: value.key.trim().toUpperCase(),
          description: value.description?.trim() || undefined,
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
            <DialogTitle>New Team</DialogTitle>
            <DialogDescription>
              Create a team space to organize issues, members, and cycles.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Team Name */}
              <div className="sm:col-span-2">
                <form.Field
                  name="name"
                  validators={{
                    onChange: ({ value }) => (!value?.trim() ? 'Team name is required' : undefined),
                  }}
                  children={(field) => {
                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Team Name</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          placeholder="e.g. Engineering, Core Product..."
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => {
                            field.handleChange(e.target.value);
                            // Auto-suggest identifier key if empty
                            const currentKey = form.getFieldValue('key');
                            if (!currentKey && e.target.value) {
                              const autoKey = e.target.value
                                .trim()
                                .split(/\s+/)
                                .map((w) => w[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 4);
                              if (autoKey) form.setFieldValue('key', autoKey);
                            }
                          }}
                          autoFocus
                          required
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    );
                  }}
                />
              </div>

              {/* Identifier Key */}
              <div>
                <form.Field
                  name="key"
                  validators={{
                    onChange: ({ value }) =>
                      !value?.trim()
                        ? 'Key is required'
                        : value.trim().length > 8
                        ? 'Max 8 chars'
                        : undefined,
                  }}
                  children={(field) => {
                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Team Key</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          placeholder="ENG, DES..."
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                          className="font-mono uppercase"
                          required
                          maxLength={8}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    );
                  }}
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground font-mono">
              Issues created in this team will use this key prefix (e.g. <span className="font-semibold text-foreground">{form.getFieldValue('key') || 'ENG'}-1</span>).
            </p>

            {/* Description Field */}
            <form.Field
              name="description"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    placeholder="What is this team responsible for?"
                    rows={2}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </Field>
              )}
            />
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
                  {createMutation.isPending || isSubmitting ? 'Creating...' : 'Create Team'}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
