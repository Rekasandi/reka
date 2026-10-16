import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@reka/ui';
import { acceptTriageIssue, createIssueTemplate, deleteIssueTemplate, declineTriageIssue, duplicateTriageIssue, getIssueTemplates, getTriage, submitIssueTemplate, type IntakeSubmission } from '../api/triage.api';

export function useTriage(teamId?: string) {
  return useQuery({ queryKey: ['triage', teamId ?? 'all'], queryFn: () => getTriage(teamId) });
}

export function useIssueTemplates(teamId?: string) {
  return useQuery({ queryKey: ['issue-templates', teamId ?? 'all'], queryFn: () => getIssueTemplates(teamId) });
}

export function useCreateIssueTemplate() {
  const client = useQueryClient();
  return useMutation({ mutationFn: createIssueTemplate, onSuccess: () => {
    client.invalidateQueries({ queryKey: ['issue-templates'] }); toast.success('Intake template created');
  }, onError: error => toast.error('Could not create intake template', { description: error.message }) });
}

export function useDeleteIssueTemplate() {
  const client = useQueryClient();
  return useMutation({ mutationFn: deleteIssueTemplate, onSuccess: () => {
    client.invalidateQueries({ queryKey: ['issue-templates'] }); toast.success('Intake template deleted');
  }, onError: error => toast.error('Could not delete intake template', { description: error.message }) });
}

export function useSubmitIssueTemplate() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: IntakeSubmission }) => submitIssueTemplate(id, input), onSuccess: issue => {
    client.invalidateQueries({ queryKey: ['triage'] }); client.invalidateQueries({ queryKey: ['issues'] });
    toast.success(`Submitted ${issue.identifier} to triage`);
  }, onError: error => toast.error('Intake could not be submitted', { description: error.message }) });
}

export function useTriageAction() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (input: { action: 'accept'; id: string; teamId: string; status: string; assigneeId?: string | null } | { action: 'decline'; id: string; reason: string } | { action: 'duplicate'; id: string; targetId: string }) => {
    if (input.action === 'accept') return acceptTriageIssue(input.id, { teamId: input.teamId, status: input.status, assigneeId: input.assigneeId });
    if (input.action === 'decline') return declineTriageIssue(input.id, input.reason);
    return duplicateTriageIssue(input.id, input.targetId);
  }, onSuccess: (_issue, input) => {
    client.invalidateQueries({ queryKey: ['triage'] }); client.invalidateQueries({ queryKey: ['issues'] });
    client.invalidateQueries({ queryKey: ['issue-relations'] });
    client.invalidateQueries({ queryKey: ['activities', input.id] });
    client.invalidateQueries({ queryKey: ['teams'] });
    toast.success(input.action === 'accept' ? 'Issue routed from triage' : input.action === 'decline' ? 'Intake declined' : 'Duplicate linked and archived');
  }, onError: error => toast.error('Triage action failed', { description: error.message }) });
}
