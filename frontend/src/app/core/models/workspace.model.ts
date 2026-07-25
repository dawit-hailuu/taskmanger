export type WorkspaceType = 'PERSONAL' | 'TEAM';
export type WorkspaceRole = 'MEMBER' | 'ADMIN' | 'OWNER';

export interface Workspace {
  id: number;
  name: string;
  description: string | null;
  type: WorkspaceType;
  myRole: WorkspaceRole;
  memberCount: number;
  createdAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  description: string | null;
}

export type UpdateWorkspaceRequest = CreateWorkspaceRequest;

export interface WorkspaceMember {
  userId: number;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export const WORKSPACE_ROLES: WorkspaceRole[] = ['MEMBER', 'ADMIN', 'OWNER'];

/** True if this role can manage workspace settings and members. */
export function canManageWorkspace(role: WorkspaceRole): boolean {
  return role === 'ADMIN' || role === 'OWNER';
}
