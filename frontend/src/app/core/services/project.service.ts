import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Page, Task } from '../models/task.model';
import {
  CreateProjectRequest,
  Project,
  ProjectMember,
  ProjectRole,
  UpdateProjectRequest,
} from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  create(workspaceId: number, payload: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>(`${this.apiUrl}/workspaces/${workspaceId}/projects`, payload);
  }

  listForWorkspace(workspaceId: number): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/workspaces/${workspaceId}/projects`);
  }

  get(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/projects/${id}`);
  }

  update(id: number, payload: UpdateProjectRequest): Observable<Project> {
    return this.http.put<Project>(`${this.apiUrl}/projects/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${id}`);
  }

  listMembers(id: number): Observable<ProjectMember[]> {
    return this.http.get<ProjectMember[]>(`${this.apiUrl}/projects/${id}/members`);
  }

  addMember(id: number, email: string, role: ProjectRole): Observable<ProjectMember> {
    return this.http.post<ProjectMember>(`${this.apiUrl}/projects/${id}/members`, { email, role });
  }

  removeMember(id: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/projects/${id}/members/${userId}`);
  }

  changeMemberRole(id: number, userId: number, role: ProjectRole): Observable<ProjectMember> {
    return this.http.patch<ProjectMember>(`${this.apiUrl}/projects/${id}/members/${userId}/role`, { role });
  }

  listTasks(id: number, page = 0, size = 20): Observable<Page<Task>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size))
      .set('sortBy', 'createdAt')
      .set('direction', 'desc');
    return this.http.get<Page<Task>>(`${this.apiUrl}/projects/${id}/tasks`, { params });
  }
}
