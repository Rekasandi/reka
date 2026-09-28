import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
  Sparkles,
  ExternalLink,
  Mail,
  Phone,
  Trash2,
  Briefcase,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useClients, useDeleteClient, useSeedDemoClients } from '../hooks/use-clients';
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
  const seedDemoMutation = useSeedDemoClients();

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
    <div className="flex flex-col gap-6 max-w-7xl mx-auto selection:bg-foreground selection:text-background pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.03em] text-foreground">
              Clients
            </h1>
            <span className="font-mono text-xs font-medium text-muted-foreground bg-secondary/80 border border-border/60 px-2 py-0.5 rounded-[5px]">
              {clients.length}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Client accounts, external contracts, stakeholders, and associated software delivery projects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {clients.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => seedDemoMutation.mutate()}
              disabled={seedDemoMutation.isPending}
            >
              <Sparkles className="size-3.5 text-blue-500" />
              <span>Seed Demo Clients</span>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-[6px] h-8 px-3 text-xs font-medium gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>New Client</span>
          </Button>
        </div>
      </div>

      {/* Account summary: one calm information band instead of repeated metric cards */}
      <div className="grid grid-cols-1 divide-y divide-border/70 rounded-lg border border-border/70 bg-card/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <Building2 className="size-4 text-muted-foreground" />
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tracking-tight text-foreground">{clients.length}</span>
            <span className="text-xs text-muted-foreground">client accounts</span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <FolderKanban className="size-4 text-muted-foreground" />
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold tracking-tight text-foreground">{totalProjects}</span>
            <span className="text-xs text-muted-foreground">active projects</span>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
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
          <button
            type="button"
            onClick={() => setIndustryFilter('all')}
            className={`h-7 px-2.5 text-xs rounded-[6px] font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
              industryFilter === 'all'
                ? 'bg-foreground text-background shadow-2xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
            }`}
          >
            <span>All Industries</span>
            <span className="font-mono text-xs text-muted-foreground">{clients.length}</span>
          </button>

          {industries.map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => setIndustryFilter(ind)}
              className={`h-7 px-2.5 text-xs rounded-[6px] font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                industryFilter === ind
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}
            >
              <span>{ind}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {clients.filter((c) => c.industry === ind).length}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search clients or contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <span>Failed to load clients. Verify database connection.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="rounded-[6px]">
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
                : 'Get started by creating your first client account or generating sample data.'}
            </p>
          </div>
          {!searchQuery && industryFilter === 'all' && (
            <div className="flex items-center gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => seedDemoMutation.mutate()}
                disabled={seedDemoMutation.isPending}
              >
                <Sparkles className="size-3.5 text-blue-500" />
                <span>Seed Sample Clients</span>
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="size-3.5" />
                <span>Create Client</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const primaryContact = client.contacts?.[0];

            return (
              <Card
                key={client.id}
                onClick={() => handleOpenDetail(client)}
                className="rounded-lg border border-border bg-card hover:border-foreground/25 transition-colors cursor-pointer flex flex-col justify-between group shadow-none"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 className="size-4 text-muted-foreground shrink-0" />
                      <CardTitle className="text-sm font-semibold truncate group-hover:text-foreground">
                        {client.name}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {client.industry && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {client.industry}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <CardDescription className="text-xs line-clamp-2 text-muted-foreground leading-relaxed mt-2 min-h-[32px]">
                    {client.notes || 'No description or account notes recorded.'}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 py-2 flex flex-col gap-2">
                  {/* Linked Projects Preview */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span className="font-mono text-xs flex items-center gap-1">
                      <FolderKanban className="size-3" />
                      <span>{client.projectCount || 0} projects</span>
                    </span>

                    <span className="font-mono text-xs flex items-center gap-1">
                      <Users className="size-3" />
                      <span>{client.contactCount || 0} contacts</span>
                    </span>
                  </div>

                  {/* Primary contact preview if available */}
                  {primaryContact && (
                    <div className="rounded-[6px] bg-background/60 border border-border/60 p-2 text-xs flex items-center justify-between">
                      <span className="font-medium text-foreground truncate max-w-[140px]">
                        {primaryContact.name}
                      </span>
                      <span className="text-muted-foreground truncate max-w-[140px] font-mono text-xs">
                        {primaryContact.email}
                      </span>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="p-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <span className="text-xs">
                    Added {new Date(client.createdAt).toLocaleDateString()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-foreground font-medium group-hover:translate-x-0.5 transition-transform">
                    <span>Manage</span>
                    <ChevronRight className="size-3" />
                  </span>
                </CardFooter>
              </Card>
            );
          })}
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
