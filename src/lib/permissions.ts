const FULL_ACCESS = ['SUPER_ADMIN', 'ADMIN']

export function canEdit(role: string): boolean {
  return FULL_ACCESS.includes(role) || role === 'TECHNICIAN'
}

export function isAdmin(role: string): boolean {
  return FULL_ACCESS.includes(role)
}

export function isReadOnly(role: string): boolean {
  return role === 'BMVM' || role === 'ASSIST_ADMIN' || role === 'ENGINEER'
}

export function canComment(role: string): boolean {
  return FULL_ACCESS.includes(role) || role === 'ENGINEER'
}

export function canAccessProject(
  role: string,
  userProjectIds: string[],
  projectId: string
): boolean {
  if (FULL_ACCESS.includes(role)) return true
  return userProjectIds.includes(projectId)
}

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  TECHNICIAN: 'ช่าง/Technician',
  ASSIST_ADMIN: 'Assist Admin',
  BMVM: 'BM/VM',
  ENGINEER: 'Engineer',
}

export const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-accent-light text-accent-dark',
  ADMIN: 'bg-accent-light text-accent-dark',
  TECHNICIAN: 'bg-info-light text-info',
  ASSIST_ADMIN: 'bg-warn-light text-warn',
  BMVM: 'bg-pm-muted text-pm-text-2',
  ENGINEER: 'bg-purple-100 text-purple-700',
}
