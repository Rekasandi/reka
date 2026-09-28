import { useParams } from 'react-router-dom';
import { IssuesPage } from '../../issues/components/issues-page';

export function TeamIssuesPage() {
  const { id } = useParams<{ id: string }>();
  return id ? <IssuesPage teamId={id} /> : null;
}
