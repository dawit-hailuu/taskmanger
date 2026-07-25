import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Subtask,
  TagRef,
  TaskAttachment,
  TaskCollaborator,
  TaskComment,
  TaskDependencies,
} from '../models/task.model';

/** Wraps every task sub-resource endpoint used by the Task Detail page. */
@Injectable({ providedIn: 'root' })
export class TaskDetailService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private taskUrl(taskId: number): string {
    return `${this.apiUrl}/tasks/${taskId}`;
  }

  // ---- assignees ----

  listAssignees(taskId: number): Observable<TaskCollaborator[]> {
    return this.http.get<TaskCollaborator[]>(`${this.taskUrl(taskId)}/assignees`);
  }

  addAssignee(taskId: number, userId: number): Observable<TaskCollaborator> {
    return this.http.post<TaskCollaborator>(`${this.taskUrl(taskId)}/assignees`, { userId });
  }

  removeAssignee(taskId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/assignees/${userId}`);
  }

  // ---- watchers ----

  listWatchers(taskId: number): Observable<TaskCollaborator[]> {
    return this.http.get<TaskCollaborator[]>(`${this.taskUrl(taskId)}/watchers`);
  }

  watch(taskId: number): Observable<TaskCollaborator> {
    return this.http.post<TaskCollaborator>(`${this.taskUrl(taskId)}/watchers/me`, {});
  }

  unwatch(taskId: number): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/watchers/me`);
  }

  // ---- tags ----

  listTaskTags(taskId: number): Observable<TagRef[]> {
    return this.http.get<TagRef[]>(`${this.taskUrl(taskId)}/tags`);
  }

  attachTag(taskId: number, tagId: number): Observable<TagRef> {
    return this.http.post<TagRef>(`${this.taskUrl(taskId)}/tags/${tagId}`, {});
  }

  detachTag(taskId: number, tagId: number): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/tags/${tagId}`);
  }

  // ---- subtasks ----

  listSubtasks(taskId: number): Observable<Subtask[]> {
    return this.http.get<Subtask[]>(`${this.taskUrl(taskId)}/subtasks`);
  }

  createSubtask(taskId: number, title: string): Observable<Subtask> {
    return this.http.post<Subtask>(`${this.taskUrl(taskId)}/subtasks`, { title });
  }

  updateSubtask(taskId: number, subtaskId: number, title: string, completed: boolean): Observable<Subtask> {
    return this.http.put<Subtask>(`${this.taskUrl(taskId)}/subtasks/${subtaskId}`, { title, completed });
  }

  deleteSubtask(taskId: number, subtaskId: number): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/subtasks/${subtaskId}`);
  }

  // ---- dependencies ----

  listDependencies(taskId: number): Observable<TaskDependencies> {
    return this.http.get<TaskDependencies>(`${this.taskUrl(taskId)}/dependencies`);
  }

  addDependency(taskId: number, dependsOnTaskId: number): Observable<unknown> {
    return this.http.post(`${this.taskUrl(taskId)}/dependencies`, { dependsOnTaskId });
  }

  removeDependency(taskId: number, dependsOnTaskId: number): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/dependencies/${dependsOnTaskId}`);
  }

  // ---- comments ----

  listComments(taskId: number): Observable<TaskComment[]> {
    return this.http.get<TaskComment[]>(`${this.taskUrl(taskId)}/comments`);
  }

  createComment(taskId: number, content: string): Observable<TaskComment> {
    return this.http.post<TaskComment>(`${this.taskUrl(taskId)}/comments`, { content });
  }

  updateComment(taskId: number, commentId: number, content: string): Observable<TaskComment> {
    return this.http.put<TaskComment>(`${this.taskUrl(taskId)}/comments/${commentId}`, { content });
  }

  deleteComment(taskId: number, commentId: number): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/comments/${commentId}`);
  }

  // ---- attachments ----

  listAttachments(taskId: number): Observable<TaskAttachment[]> {
    return this.http.get<TaskAttachment[]>(`${this.taskUrl(taskId)}/attachments`);
  }

  uploadAttachment(taskId: number, file: File): Observable<TaskAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<TaskAttachment>(`${this.taskUrl(taskId)}/attachments`, formData);
  }

  deleteAttachment(taskId: number, attachmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.taskUrl(taskId)}/attachments/${attachmentId}`);
  }
}
