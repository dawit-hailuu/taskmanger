export type ProjectRole = 'VIEWER' | 'MEMBER' | 'MANAGER' | 'OWNER';

export interface Project {
  id: number;
  workspaceId: number;
  name: string;
  description: string | null;
  deadline: string | null;
  progressPercentage: number;
  memberCount: number;
  taskCount: number;
  myRole: ProjectRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description: string | null;
  deadline: string | null;
}

export type UpdateProjectRequest = CreateProjectRequest;

export interface ProjectMember {
  userId: number;
  name: string;
  email: string;
  role: ProjectRole;
  joinedAt: string;
}

export const PROJECT_ROLES: ProjectRole[] = ['VIEWER', 'MEMBER', 'MANAGER', 'OWNER'];

/** True if this role can manage project settings and members. */
export function canManageProject(role: ProjectRole | null): boolean {
  return role === 'MANAGER' || role === 'OWNER';
}
