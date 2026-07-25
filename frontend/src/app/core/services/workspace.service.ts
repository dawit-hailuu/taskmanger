import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '../models/workspace.model';

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/workspaces`;

  create(payload: CreateWorkspaceRequest): Observable<Workspace> {
    return this.http.post<Workspace>(this.baseUrl, payload);
  }

  list(): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(this.baseUrl);
  }

  get(id: number): Observable<Workspace> {
    return this.http.get<Workspace>(`${this.baseUrl}/${id}`);
  }

  update(id: number, payload: UpdateWorkspaceRequest): Observable<Workspace> {
    return this.http.put<Workspace>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  listMembers(id: number): Observable<WorkspaceMember[]> {
    return this.http.get<WorkspaceMember[]>(`${this.baseUrl}/${id}/members`);
  }

  addMember(id: number, email: string, role: WorkspaceRole): Observable<WorkspaceMember> {
    return this.http.post<WorkspaceMember>(`${this.baseUrl}/${id}/members`, { email, role });
  }

  removeMember(id: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}/members/${userId}`);
  }

  changeMemberRole(id: number, userId: number, role: WorkspaceRole): Observable<WorkspaceMember> {
    return this.http.patch<WorkspaceMember>(`${this.baseUrl}/${id}/members/${userId}/role`, { role });
  }
}
