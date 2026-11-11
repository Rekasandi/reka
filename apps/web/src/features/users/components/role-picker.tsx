import { Building2, Crown, Eye, ShieldCheck, User } from 'lucide-react';
import { PropertyPicker, type PropertyOption } from '../../../components/common/property-picker';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest' | 'client';

const ROLE_OPTIONS: PropertyOption<WorkspaceRole>[] = [
  { key: 'owner', label: 'Owner', icon: Crown, color: 'text-highlight' },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, color: 'text-info' },
  { key: 'member', label: 'Member', icon: User },
  { key: 'guest', label: 'Guest', hint: 'Read-only', icon: Eye },
  { key: 'client', label: 'Client', hint: 'Read-only', icon: Building2 },
];

/** Workspace role badge; editable when `onRoleChange` is given. Only owners may grant Owner. */
export function RolePicker({ role, name, onRoleChange, allowOwner = false, disabled }: {
  role: string;
  name: string;
  onRoleChange?: (role: WorkspaceRole) => void;
  allowOwner?: boolean;
  disabled?: boolean;
}) {
  return <PropertyPicker value={role} options={onRoleChange ? ROLE_OPTIONS.filter(option => allowOwner || option.key !== 'owner') : ROLE_OPTIONS} menuLabel="Role"
    ariaLabel={`Role for ${name}`} onChange={onRoleChange} disabled={disabled} />;
}
