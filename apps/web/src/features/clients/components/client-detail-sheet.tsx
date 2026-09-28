import * as React from 'react';
import type { Client, ClientContact } from '@reka/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Badge,
  Input,
  Textarea,
  Separator,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  toast,
} from '@reka/ui';
import {
  Building2,
  FolderKanban,
  Users,
  Mail,
  Phone,
  Plus,
  Trash2,
  ExternalLink,
  Edit2,
  Check,
  Briefcase,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useUpdateClient,
  useDeleteClient,
  useAddClientContact,
  useDeleteClientContact,
} from '../hooks/use-clients';
import { ConfirmDeleteDialog } from '../../../components/common/confirm-delete-dialog';

interface ClientDetailSheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailSheet({ client, open, onOpenChange }: ClientDetailSheetProps) {
  const updateMutation = useUpdateClient();
  const deleteMutation = useDeleteClient();
  const addContactMutation = useAddClientContact(client?.id);
  const deleteContactMutation = useDeleteClientContact(client?.id);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editIndustry, setEditIndustry] = React.useState('');
  const [editNotes, setEditNotes] = React.useState('');

  // Add Contact Form State
  const [isAddingContact, setIsAddingContact] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteContactTargetId, setDeleteContactTargetId] = React.useState<string | null>(null);
  const [newContactName, setNewContactName] = React.useState('');
  const [newContactEmail, setNewContactEmail] = React.useState('');
  const [newContactRole, setNewContactRole] = React.useState('');
  const [newContactPhone, setNewContactPhone] = React.useState('');

  React.useEffect(() => {
    if (client) {
      setEditName(client.name);
      setEditIndustry(client.industry || '');
      setEditNotes(client.notes || '');
      setIsEditing(false);
      setIsAddingContact(false);
    }
  }, [client]);

  if (!client) return null;

  const handleSaveDetails = () => {
    if (!editName.trim()) {
      toast.error('Client name cannot be empty');
      return;
    }
    updateMutation.mutate(
      {
        id: client.id,
        data: {
          name: editName.trim(),
          industry: editIndustry.trim() || undefined,
          notes: editNotes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    addContactMutation.mutate(
      {
        name: newContactName.trim(),
        email: newContactEmail.trim(),
        role: newContactRole.trim() || undefined,
        phone: newContactPhone.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNewContactName('');
          setNewContactEmail('');
          setNewContactRole('');
          setNewContactPhone('');
          setIsAddingContact(false);
        },
      },
    );
  };

  const handleDeleteClient = () => {
    setIsDeleteDialogOpen(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col bg-card">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/70 flex items-start justify-between gap-4 bg-muted/20">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-10 rounded-lg bg-secondary flex items-center justify-center text-foreground shrink-0 border border-border/70 mt-0.5">
              <Building2 className="size-5 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg font-semibold tracking-tight text-foreground truncate">
                  {client.name}
                </SheetTitle>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {client.industry && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {client.industry}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  Added {new Date(client.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="h-8 text-xs gap-1"
            >
              <Edit2 className="size-3" />
              <span>{isEditing ? 'Cancel' : 'Edit'}</span>
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Editable Details Form */}
          {isEditing ? (
            <div className="space-y-4 rounded-lg border border-border/80 bg-background/80 p-4">
              <span className="text-xs font-semibold text-foreground block">Edit Client Info</span>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Client Name
                  </label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Industry
                  </label>
                  <Input
                    value={editIndustry}
                    onChange={(e) => setEditIndustry(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Notes & Scope
                  </label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="text-xs resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleSaveDetails}
                    disabled={updateMutation.isPending}
                  >
                    <Check className="size-3" />
                    <span>Save Changes</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            client.notes && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <span className="text-xs font-medium text-muted-foreground block mb-1">
                  Account Notes & Overview
                </span>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {client.notes}
                </p>
              </div>
            )
          )}

          {/* Associated Projects Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="size-4 text-purple-500" />
                <h3 className="text-sm font-semibold text-foreground">Associated Projects</h3>
                <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                  {client.projects?.length || 0}
                </span>
              </div>
              <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1">
                <Link to="/projects">
                  <span>View All Projects</span>
                  <ExternalLink className="size-3" />
                </Link>
              </Button>
            </div>

            <div className="rounded-lg border border-border/80 divide-y divide-border/60 bg-card/40 overflow-hidden">
              {!client.projects || client.projects.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <p>No projects linked to this client yet.</p>
                  <p className="text-xs mt-0.5">
                    Assign a project to {client.name} during project creation or in project settings.
                  </p>
                </div>
              ) : (
                client.projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/projects/${proj.id}`}
                          className="text-xs font-semibold text-foreground hover:underline truncate"
                        >
                          {proj.name}
                        </Link>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {proj.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs font-mono capitalize">
                        {proj.status.replace('_', ' ')}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
                        <Link to={`/projects/${proj.id}`}>
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Client Contacts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-foreground">Client Contacts</h3>
                <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-muted">
                  {client.contacts?.length || 0}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => setIsAddingContact(!isAddingContact)}
              >
                <Plus className="size-3" />
                <span>Add Contact</span>
              </Button>
            </div>

            {/* Add Contact Inline Form */}
            {isAddingContact && (
              <div className="rounded-lg border border-border/80 bg-background/90 p-4 space-y-3">
                <span className="text-xs font-semibold text-foreground block">
                  New Contact Information
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Full Name *
                    </label>
                    <Input
                      placeholder="e.g. Siska Dewi"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Email Address *
                    </label>
                    <Input
                      type="email"
                      placeholder="siska@client.com"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Role / Position
                    </label>
                    <Input
                      placeholder="e.g. VP Operations"
                      value={newContactRole}
                      onChange={(e) => setNewContactRole(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Phone Number
                    </label>
                    <Input
                      placeholder="+62 811-xxxx-xxxx"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setIsAddingContact(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddContact}
                    disabled={addContactMutation.isPending}
                  >
                    Save Contact
                  </Button>
                </div>
              </div>
            )}

            {/* Contacts List */}
            <div className="rounded-lg border border-border/80 divide-y divide-border/60 bg-card/40 overflow-hidden">
              {!client.contacts || client.contacts.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <p>No contacts recorded for this client.</p>
                  <p className="text-xs mt-0.5">Click "Add Contact" to register representatives.</p>
                </div>
              ) : (
                client.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="p-3.5 flex items-center justify-between hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {contact.name}
                        </span>
                        {contact.role && (
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                            {contact.role}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1 hover:text-foreground font-mono"
                        >
                          <Mail className="size-3" />
                          <span>{contact.email}</span>
                        </a>
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1 hover:text-foreground font-mono"
                          >
                            <Phone className="size-3" />
                            <span>{contact.phone}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600"
                      onClick={() => setDeleteContactTargetId(contact.id)}
                      title="Remove contact"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Danger Zone: Delete Client */}
          <div className="pt-4 border-t border-border/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">Delete Client</span>
              <span className="text-xs text-muted-foreground">
                Remove this client record. Associated projects will remain active.
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteClient}
              disabled={deleteMutation.isPending}
              className="h-7 text-xs border-rose-500/30 text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
            >
              <Trash2 className="size-3.5 mr-1" />
              <span>Delete</span>
            </Button>
          </div>
        </div>

        {/* Delete Client Confirmation Alert Dialog */}
        <ConfirmDeleteDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title={`Delete client "${client.name}"?`}
          description="This will permanently delete this client record. Associated projects will remain active."
          onConfirm={() => {
            deleteMutation.mutate(client.id, {
              onSuccess: () => {
                onOpenChange(false);
              },
            });
          }}
        />

        {/* Delete Contact Confirmation Alert Dialog */}
        <ConfirmDeleteDialog
          open={!!deleteContactTargetId}
          onOpenChange={(open) => !open && setDeleteContactTargetId(null)}
          title="Remove contact?"
          description="This will remove this contact representative from this client."
          onConfirm={() => {
            if (deleteContactTargetId) {
              deleteContactMutation.mutate(deleteContactTargetId);
              setDeleteContactTargetId(null);
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
