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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@reka/ui';
import { useCreateClient } from '../hooks/use-clients';

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMON_INDUSTRIES = [
  'Fintech & Payments',
  'Supply Chain & Logistics',
  'Travel & Hospitality',
  'E-Commerce & Retail',
  'Enterprise SaaS',
  'Healthcare & Biotech',
  'Developer Platform',
  'Media & Entertainment',
  'Other',
];

export function CreateClientDialog({ open, onOpenChange }: CreateClientDialogProps) {
  const createMutation = useCreateClient();

  const form = useForm({
    defaultValues: {
      name: '',
      industry: 'Fintech & Payments',
      notes: '',
      contactName: '',
      contactEmail: '',
      contactRole: '',
      contactPhone: '',
    },
    onSubmit: async ({ value }) => {
      createMutation.mutate(
        {
          name: value.name.trim(),
          industry: value.industry?.trim() || undefined,
          notes: value.notes?.trim() || undefined,
          contact:
            value.contactName.trim() && value.contactEmail.trim()
              ? {
                  name: value.contactName.trim(),
                  email: value.contactEmail.trim(),
                  role: value.contactRole?.trim() || undefined,
                  phone: value.contactPhone?.trim() || undefined,
                }
              : undefined,
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
            <DialogTitle>New Client Account</DialogTitle>
            <DialogDescription>
              Register a client company or partner to associate projects and contacts.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-1 gap-3.5">
            {/* Client Name */}
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => (!value.trim() ? 'Client name is required' : undefined),
              }}
            >
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="client-name">
                    Client Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="client-name"
                    placeholder="e.g. PT Finansia Digital Indonesia"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors ? (
                    <FieldError>{field.state.meta.errors.join(', ')}</FieldError>
                  ) : null}
                </Field>
              )}
            </form.Field>

            {/* Industry */}
            <form.Field name="industry">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="client-industry">Industry</FieldLabel>
                  <Select value={field.state.value} onValueChange={(val) => field.handleChange(val)}>
                    <SelectTrigger id="client-industry" className="h-9">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind}>
                          {ind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

            {/* Notes / Summary */}
            <form.Field name="notes">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="client-notes">Description & Account Notes</FieldLabel>
                  <Textarea
                    id="client-notes"
                    placeholder="Project scope summary, billing arrangements, SLA expectations..."
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={2}
                  />
                </Field>
              )}
            </form.Field>

            {/* Primary Contact Group */}
            <div className="pt-2 border-t border-border/60">
              <span className="text-xs font-medium text-muted-foreground block mb-2">
                Primary Contact (Optional)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <form.Field name="contactName">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="contact-name" className="text-xs">
                        Contact Name
                      </FieldLabel>
                      <Input
                        id="contact-name"
                        placeholder="e.g. Budi Hartono"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </Field>
                  )}
                </form.Field>

                <form.Field name="contactEmail">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="contact-email" className="text-xs">
                        Email Address
                      </FieldLabel>
                      <Input
                        id="contact-email"
                        type="email"
                        placeholder="budi@company.com"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </Field>
                  )}
                </form.Field>

                <form.Field name="contactRole">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="contact-role" className="text-xs">
                        Role / Title
                      </FieldLabel>
                      <Input
                        id="contact-role"
                        placeholder="e.g. VP of Product"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </Field>
                  )}
                </form.Field>

                <form.Field name="contactPhone">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor="contact-phone" className="text-xs">
                        Phone / WhatsApp
                      </FieldLabel>
                      <Input
                        id="contact-phone"
                        placeholder="+62 812-xxxx-xxxx"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </Field>
                  )}
                </form.Field>
              </div>
            </div>
          </FieldGroup>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
