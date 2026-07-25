import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TagRef } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listForWorkspace(workspaceId: number): Observable<TagRef[]> {
    return this.http.get<TagRef[]>(`${this.apiUrl}/workspaces/${workspaceId}/tags`);
  }

  create(workspaceId: number, name: string, color: string | null): Observable<TagRef> {
    return this.http.post<TagRef>(`${this.apiUrl}/workspaces/${workspaceId}/tags`, { name, color });
  }

  delete(tagId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tags/${tagId}`);
  }
}
