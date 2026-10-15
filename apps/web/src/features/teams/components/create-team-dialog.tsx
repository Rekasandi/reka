import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Input, Textarea, Field, FieldLabel, FieldDescription, FieldError, FieldGroup, Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@reka/ui';
import { useCreateTeam } from '../hooks/use-teams';

function suggestIdentifier(name: string) {
  const words = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().match(/[A-Z0-9]+/g) || [];
  return (words.length > 1 ? words.map(word => word[0]).join('') : words[0]?.slice(0, 3) || '').replace(/^[^A-Z]+/, '').slice(0, 10);
}

export function CreateTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const create = useCreateTeam();
  const [name, setName] = React.useState('');
  const [key, setKey] = React.useState('');
  const [keyEdited, setKeyEdited] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [visibility, setVisibility] = React.useState('workspace');
  const keyValid = /^[A-Z][A-Z0-9]{0,9}$/.test(key);
  React.useEffect(() => {
    if (open) { setName(''); setKey(''); setKeyEdited(false); setDescription(''); setVisibility('workspace'); create.reset(); }
  }, [open]);
  return <Dialog open={open} onOpenChange={next => { if (!create.isPending) onOpenChange(next); }}>
    <DialogContent className="sm:max-w-lg">
      <form className="flex flex-col gap-5" onSubmit={event => {
        event.preventDefault();
        if (!name.trim() || !keyValid || create.isPending) return;
        create.mutate({ name: name.trim(), key, description: description.trim() || undefined, isPrivate: visibility === 'private' }, { onSuccess: team => {
          onOpenChange(false);
          navigate(`/teams/${team.id}?tab=members`);
        } });
      }}>
        <DialogHeader><DialogTitle>Create team</DialogTitle><DialogDescription>Organize work and people. You will become the team lead, then add members.</DialogDescription></DialogHeader>
        <FieldGroup>
          <Field><FieldLabel htmlFor="create-team-name">Team name</FieldLabel><Input id="create-team-name" autoFocus required maxLength={255} placeholder="e.g. Engineering" value={name} disabled={create.isPending} onChange={event => { setName(event.target.value); if (!keyEdited) setKey(suggestIdentifier(event.target.value)); }} /></Field>
          <Field data-invalid={!!key && !keyValid}><FieldLabel htmlFor="create-team-key">Identifier</FieldLabel><Input id="create-team-key" aria-invalid={!!key && !keyValid} required maxLength={10} pattern="[A-Z][A-Z0-9]{0,9}" title="Start with a letter; use up to 10 uppercase letters or numbers." className="font-mono" placeholder="ENG" value={key} disabled={create.isPending} onChange={event => { const value = event.target.value.toUpperCase(); setKey(value); setKeyEdited(!!value); }} /><FieldDescription>Used in issue identifiers, such as <span className="font-mono">{key || 'ENG'}-1</span>. You can edit the suggestion.</FieldDescription>{key && !keyValid && <FieldError>Use up to 10 letters or numbers, starting with a letter.</FieldError>}</Field>
          <Field><FieldLabel htmlFor="create-team-visibility">Visibility</FieldLabel><Select value={visibility} onValueChange={setVisibility} disabled={create.isPending}><SelectTrigger id="create-team-visibility" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="workspace">Workspace</SelectItem><SelectItem value="private">Private</SelectItem></SelectGroup></SelectContent></Select><FieldDescription>{visibility === 'private' ? 'Only explicitly added members can find or view this team, including owners and admins.' : 'Every active workspace member can find this team. Members with write access can join.'}</FieldDescription></Field>
          <Field><FieldLabel htmlFor="create-team-description">Description (optional)</FieldLabel><Textarea id="create-team-description" rows={2} maxLength={4000} placeholder="What is this team responsible for?" value={description} onChange={event => setDescription(event.target.value)} disabled={create.isPending} /></Field>
        </FieldGroup>
        {create.isError && <Alert variant="destructive"><AlertDescription>{create.error.message}</AlertDescription></Alert>}
        <DialogFooter><Button type="button" variant="outline" disabled={create.isPending} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={create.isPending || !name.trim() || !keyValid}>{create.isPending ? 'Creating…' : 'Create team'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
