import * as React from 'react';
import {
  Badge,
  Button,
  Input,
  Skeleton,
} from '@reka/ui';
import {
  Building2,
  Plus,
  FolderKanban,
  Users,
  Search,
  X,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useClients } from '../hooks/use-clients';
import { CreateClientDialog } from './create-client-dialog';
import { ClientDetailSheet } from './client-detail-sheet';
import type { Client } from '@reka/types';

export function ClientsPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [industryFilter, setIndustryFilter] = React.useState('all');

  const { data: clients = [], isLoading, isError, refetch } = useClients();

  // Distinct industries for tabs
  const industries = React.useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.industry) set.add(c.industry);
    });
    return Array.from(set);
  }, [clients]);

  // Filtered clients list
  const filteredClients = React.useMemo(() => {
    let list = clients;

    if (industryFilter !== 'all') {
      list = list.filter((c) => c.industry === industryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.industry && c.industry.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q)) ||
          (c.contacts &&
            c.contacts.some(
              (ct) =>
                ct.name.toLowerCase().includes(q) || ct.email.toLowerCase().includes(q),
            )),
      );
    }

    return list;
  }, [clients, industryFilter, searchQuery]);

  const handleOpenDetail = (client: Client) => {
    setSelectedClient(client);
    setIsDetailOpen(true);
  };

  // Metrics summary
  const totalProjects = clients.reduce((acc, c) => acc + (c.projectCount || 0), 0);
  const totalContacts = clients.reduce((acc, c) => acc + (c.contactCount || 0), 0);

  return (
    <div className="flex flex-col gap-5 max-w-none mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Clients
            </h1>
            <Badge variant="outline" className="font-mono text-xs font-medium">
              {clients.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Client accounts, contacts, and linked projects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setIsCreateOpen(true)} className="px-3">
            <Plus data-icon="inline-start" />
            <span>New Client</span>
          </Button>
        </div>
      </div>

      {/* Account summary: one calm information band instead of repeated metric cards */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          <Building2 className="size-4 text-muted-foreground" />
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tracking-tight text-foreground">{clients.length}</span>
            <span className="text-xs text-muted-foreground">client accounts</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <FolderKanban className="size-4 text-muted-foreground" />
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tracking-tight text-foreground">{totalProjects}</span>
            <span className="text-xs text-muted-foreground">linked projects</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Users className="size-4 text-muted-foreground" />
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tracking-tight text-foreground">{totalContacts}</span>
            <span className="text-xs text-muted-foreground">key contacts</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
        {/* Industry Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            type="button"
            variant="category"
            size="sm"
            aria-pressed={industryFilter === 'all'}
            onClick={() => setIndustryFilter('all')}
            className="shrink-0"
          >
            <span>All Industries</span>
          </Button>

          {industries.map((ind) => (
            <Button
              key={ind}
              type="button"
              variant="category"
              size="sm"
              aria-pressed={industryFilter === ind}
              onClick={() => setIndustryFilter(ind)}
              className="shrink-0"
            >
              <span>{ind}</span>
            </Button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            aria-label="Search clients or contacts"
            placeholder="Search clients or contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear client search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Client list */}
      {isLoading ? (
        <div role="status" aria-label="Loading clients" className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Could not load clients. Please try again.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw data-icon="inline-start" className="size-3.5" />
            <span>Retry</span>
          </Button>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="col-span-full rounded-lg border border-dashed border-border/80 p-14 text-center text-xs text-muted-foreground bg-card/10 flex flex-col items-center gap-3">
          <Building2 className="size-8 text-muted-foreground/40" />
          <div>
            <p className="font-semibold text-foreground text-sm">No clients found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {searchQuery || industryFilter !== 'all'
                ? 'Try adjusting your search query or industry filter.'
                : 'Create a client account to get started.'}
            </p>
          </div>
          {!searchQuery && industryFilter === 'all' && (
            <Button
              className="gap-1.5"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              <span>Create Client</span>
            </Button>
          )}
        </div>
      ) : (
        <div>
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1.5fr)_120px_minmax(0,1fr)_80px_80px_110px_16px] items-center gap-4 border-b border-border px-3 pb-3 text-xs text-muted-foreground xl:grid">
            <span>Client</span><span>Industry</span><span>Primary contact</span>
            <span>Projects</span><span>Contacts</span><span>Added</span><span />
          </div>
          <ul aria-label="Clients" className="divide-y divide-border">
            {filteredClients.map((client) => {
              const primaryContact = client.contacts?.[0];
              return (
                <li key={client.id}>
                  <button
                    type="button"
                    aria-label={`Open client ${client.name}`}
                    onClick={() => handleOpenDetail(client)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_16px] items-center gap-4 rounded-md px-3 py-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[minmax(0,1.5fr)_120px_minmax(0,1fr)_80px_80px_110px_16px]"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-sm font-medium">{client.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{client.notes || 'No account notes recorded.'}</span>
                        {primaryContact && <span className="truncate text-xs text-muted-foreground xl:hidden">{primaryContact.name} · {primaryContact.email}</span>}
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground xl:hidden">
                          {client.industry && <span>{client.industry}</span>}
                          <span>{client.projectCount || 0} projects</span>
                          <span>{client.contactCount || 0} contacts</span>
                        </span>
                      </span>
                    </span>
                    <span className="hidden truncate text-xs text-muted-foreground xl:block">{client.industry || 'No industry'}</span>
                    <span className="hidden min-w-0 flex-col gap-1 text-xs xl:flex">
                      <span className="truncate">{primaryContact?.name || 'No primary contact'}</span>
                      {primaryContact && <span className="truncate text-muted-foreground">{primaryContact.email}</span>}
                    </span>
                    <span className="hidden items-center gap-2 text-xs tabular-nums text-muted-foreground xl:flex"><FolderKanban className="size-3.5" />{client.projectCount || 0}<span className="sr-only">projects</span></span>
                    <span className="hidden items-center gap-2 text-xs tabular-nums text-muted-foreground xl:flex"><Users className="size-3.5" />{client.contactCount || 0}<span className="sr-only">contacts</span></span>
                    <span className="hidden text-xs text-muted-foreground xl:block">{new Date(client.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Create Client Dialog */}
      <CreateClientDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Client Detail Sheet */}
      <ClientDetailSheet
        client={selectedClient}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </div>
  );
}
