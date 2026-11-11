import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from '@tanstack/react-form';
import { Alert, AlertDescription, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input, Textarea, Field, FieldLabel, FieldDescription, FieldError, FieldGroup } from '@reka/ui';
import { SelectField } from '../../../components/common/select-field';
import { useCreateTeam } from '../hooks/use-teams';

function suggestIdentifier(name: string) {
  const words = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().match(/[A-Z0-9]+/g) || [];
  return (words.length > 1 ? words.map(word => word[0]).join('') : words[0]?.slice(0, 3) || '').replace(/^[^A-Z]+/, '').slice(0, 10);
}

export function CreateTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const create = useCreateTeam();
  const [keyEdited, setKeyEdited] = React.useState(false);
  const form = useForm({
    defaultValues: { name: '', key: '', description: '', visibility: 'workspace' },
    onSubmit: ({ value }) => {
      if (create.isPending) return;
      create.mutate({ name: value.name.trim(), key: value.key, description: value.description.trim() || undefined, isPrivate: value.visibility === 'private' }, { onSuccess: team => {
        onOpenChange(false);
        navigate(`/teams/${team.id}?tab=members`);
      } });
    },
  });
  React.useEffect(() => {
    if (open) { form.reset(); setKeyEdited(false); create.reset(); }
  }, [open]);
  return <Dialog open={open} onOpenChange={next => { if (!create.isPending) onOpenChange(next); }}>
    <DialogContent className="sm:max-w-lg">
      <form className="flex flex-col gap-5" onSubmit={event => { event.preventDefault(); event.stopPropagation(); form.handleSubmit(); }}>
        <DialogHeader><DialogTitle>New team</DialogTitle><DialogDescription>Organize work and people. You will become the team lead, then add members.</DialogDescription></DialogHeader>
        <FieldGroup>
          <form.Field name="name" validators={{ onChange: ({ value }) => (!value.trim() ? 'Team name is required' : undefined) }}>
            {field => <Field><FieldLabel htmlFor="create-team-name">Team name</FieldLabel><Input id="create-team-name" name={field.name} autoFocus required maxLength={255} placeholder="e.g. Engineering" value={field.state.value} disabled={create.isPending} onBlur={field.handleBlur} onChange={event => { field.handleChange(event.target.value); if (!keyEdited) form.setFieldValue('key', suggestIdentifier(event.target.value)); }} /></Field>}
          </form.Field>
          <form.Field name="key" validators={{ onChange: ({ value }) => (!/^[A-Z][A-Z0-9]{0,9}$/.test(value) ? 'Use up to 10 letters or numbers, starting with a letter.' : undefined) }}>
            {field => {
              const key = field.state.value;
              const keyValid = /^[A-Z][A-Z0-9]{0,9}$/.test(key);
              return <Field data-invalid={!!key && !keyValid}><FieldLabel htmlFor="create-team-key">Identifier</FieldLabel><Input id="create-team-key" name={field.name} aria-invalid={!!key && !keyValid} required maxLength={10} pattern="[A-Z][A-Z0-9]{0,9}" title="Start with a letter; use up to 10 uppercase letters or numbers." className="font-mono" placeholder="ENG" value={key} disabled={create.isPending} onBlur={field.handleBlur} onChange={event => { const value = event.target.value.toUpperCase(); field.handleChange(value); setKeyEdited(!!value); }} /><FieldDescription>Used in issue identifiers, such as <span className="font-mono">{key || 'ENG'}-1</span>. You can edit the suggestion.</FieldDescription>{key && !keyValid && <FieldError>Use up to 10 letters or numbers, starting with a letter.</FieldError>}</Field>;
            }}
          </form.Field>
          <form.Field name="visibility">
            {field => <Field><FieldLabel htmlFor="create-team-visibility">Visibility</FieldLabel><SelectField id="create-team-visibility" name={field.name} size="default" className="w-full" value={field.state.value} onValueChange={field.handleChange} disabled={create.isPending} options={[{ value: 'workspace', label: 'Workspace' }, { value: 'private', label: 'Private' }]} /><FieldDescription>{field.state.value === 'private' ? 'Only explicitly added members can find or view this team, including owners and admins.' : 'Every active workspace member can find this team. Members with write access can join.'}</FieldDescription></Field>}
          </form.Field>
          <form.Field name="description">
            {field => <Field><FieldLabel htmlFor="create-team-description">Description (optional)</FieldLabel><Textarea id="create-team-description" name={field.name} rows={2} maxLength={4000} placeholder="What is this team responsible for?" value={field.state.value} onBlur={field.handleBlur} onChange={event => field.handleChange(event.target.value)} disabled={create.isPending} /></Field>}
          </form.Field>
        </FieldGroup>
        {create.isError && <Alert variant="destructive"><AlertDescription>{create.error.message}</AlertDescription></Alert>}
        <DialogFooter><Button type="button" variant="outline" disabled={create.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><form.Subscribe selector={state => [state.values.name, state.values.key] as const}>{([name, key]) => <Button type="submit" disabled={create.isPending || !name.trim() || !/^[A-Z][A-Z0-9]{0,9}$/.test(key)}>{create.isPending ? 'Creating…' : 'Create team'}</Button>}</form.Subscribe></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
