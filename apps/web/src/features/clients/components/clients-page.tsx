import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, Button, Input, Skeleton, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@reka/ui';
import {
  Building2,
  Plus,
  FolderKanban,
  Users,
  Search,
  X,
  RefreshCw,
} from 'lucide-react';
import { useClients } from '../hooks/use-clients';
import { CreateClientDialog } from './create-client-dialog';
import { ClientDetailSheet } from './client-detail-sheet';
import type { Client } from '@reka/types';
import { useWorkspaceNavigation } from '../../settings/lib/workspace-navigation';
import { EmptyState, PageContainer, PageHeader } from '../../../components/common/page';

/** Clients is an opt-in workspace feature; until an admin enables it the page is unavailable. */
export function ClientsPage() {
  const { features, isLoading } = useWorkspaceNavigation();
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!features.clients) return <PageContainer width="narrow"><Alert><AlertDescription>Clients is turned off for this workspace. An admin can enable it in <Link to="/settings/sidebar" className="underline">Settings → Sidebar</Link>.</AlertDescription></Alert></PageContainer>;
  return <ClientsPageContent />;
}

function ClientsPageContent() {
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
    <PageContainer>
      <PageHeader title="Clients" count={clients.length} description="Client accounts, contacts, and linked projects."
        actions={<Button onClick={() => setIsCreateOpen(true)}><Plus data-icon="inline-start" />New client</Button>} />

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
            placeholder="Search clients or contacts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background"
          />
          {searchQuery && (
            <Button variant="plain" size="auto"
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear client search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="flex flex-col gap-2"><Spinner aria-label="Loading clients" className="sr-only" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>Could not load clients.</span><Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw data-icon="inline-start" />Retry clients</Button></AlertDescription></Alert>
      ) : filteredClients.length === 0 ? (
        <EmptyState icon={Building2} title={searchQuery || industryFilter !== 'all' ? 'No clients match these filters' : 'No clients yet'}
          description={searchQuery || industryFilter !== 'all' ? 'Try another search or industry filter.' : 'Create a client account to track contacts and linked projects.'}
          action={!searchQuery && industryFilter === 'all' && <Button variant="outline" onClick={() => setIsCreateOpen(true)}><Plus data-icon="inline-start" />New client</Button>} />
      ) : (
        <Table aria-label="Clients" className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="hidden w-36 xl:table-cell">Industry</TableHead>
              <TableHead className="hidden w-56 xl:table-cell">Primary contact</TableHead>
              <TableHead className="hidden w-24 text-right xl:table-cell">Projects</TableHead>
              <TableHead className="hidden w-24 text-right xl:table-cell">Contacts</TableHead>
              <TableHead className="hidden w-32 xl:table-cell">Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.map((client) => {
              const primaryContact = client.contacts?.[0];
              return (
                <TableRow key={client.id} className="cursor-pointer" onClick={() => handleOpenDetail(client)}>
                  <TableCell className="whitespace-normal">
                    <button type="button" aria-label={`Open client ${client.name}`}
                      onClick={(event) => { event.stopPropagation(); handleOpenDetail(client); }}
                      className="flex w-full min-w-0 items-start gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Building2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-medium text-foreground">{client.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{client.notes || 'No account notes recorded.'}</span>
                        {primaryContact && <span className="truncate text-xs text-muted-foreground xl:hidden">{primaryContact.name} · {primaryContact.email}</span>}
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground xl:hidden">
                          {client.industry && <span>{client.industry}</span>}
                          <span>{client.projectCount || 0} projects</span>
                          <span>{client.contactCount || 0} contacts</span>
                        </span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden truncate text-muted-foreground xl:table-cell">{client.industry || 'No industry'}</TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate">{primaryContact?.name || <span className="text-muted-foreground">No primary contact</span>}</span>
                      {primaryContact && <span className="truncate text-xs text-muted-foreground">{primaryContact.email}</span>}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums xl:table-cell">{client.projectCount || 0}</TableCell>
                  <TableCell className="hidden text-right tabular-nums xl:table-cell">{client.contactCount || 0}</TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums xl:table-cell">{new Date(client.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Create Client Dialog */}
      <CreateClientDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {/* Client Detail Sheet */}
      <ClientDetailSheet
        client={selectedClient}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </PageContainer>
  );
}
