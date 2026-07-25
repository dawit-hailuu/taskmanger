import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TaskService } from '../../core/services/task.service';
import { TaskDetailService } from '../../core/services/task-detail.service';
import { ProjectService } from '../../core/services/project.service';
import { TagService } from '../../core/services/tag.service';
import { ApiClientError } from '../../core/models/api-error';
import { ProjectMember } from '../../core/models/project.model';
import {
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  Priority,
  RECURRENCE_LABELS,
  RECURRENCE_OPTIONS,
  RecurrenceType,
  STATUS_LABELS,
  STATUS_OPTIONS,
  Subtask,
  TagRef,
  Task,
  TaskAttachment,
  TaskCollaborator,
  TaskComment,
  TaskDependencies,
  TaskHistoryEntry,
  TaskStatus,
} from '../../core/models/task.model';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="container page">
      @if (task(); as t) {
        @if (t.projectId) {
          <a class="back" [routerLink]="['/projects', t.projectId]">← Back to project</a>
        } @else {
          <a class="back" routerLink="/dashboard">← Back to dashboard</a>
        }

        @if (error()) {
          <div class="alert alert-error" role="alert">{{ error() }}</div>
        }
        @if (success()) {
          <div class="alert alert-success" role="status">{{ success() }}</div>
        }

        <!-- Details -->
        <section class="card">
          @if (editing()) {
            <form [formGroup]="form" (ngSubmit)="saveInfo()" novalidate>
              <div class="field">
                <label class="label" for="title">Title</label>
                <input id="title" type="text" class="input" formControlName="title" maxlength="150" />
              </div>
              <div class="field">
                <label class="label" for="description">Description</label>
                <textarea id="description" class="textarea" formControlName="description" rows="5"></textarea>
              </div>
              <div class="row3">
                <div class="field">
                  <label class="label" for="status">Status</label>
                  <select id="status" class="select" formControlName="status">
                    @for (s of statuses; track s) {
                      <option [value]="s">{{ statusLabel(s) }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label class="label" for="priority">Priority</label>
                  <select id="priority" class="select" formControlName="priority">
                    @for (p of priorities; track p) {
                      <option [value]="p">{{ priorityLabel(p) }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="row3">
                <div class="field">
                  <label class="label" for="startDate">Start date</label>
                  <input id="startDate" type="date" class="input" formControlName="startDate" />
                </div>
                <div class="field">
                  <label class="label" for="dueDate">Due date</label>
                  <input id="dueDate" type="date" class="input" formControlName="dueDate" />
                </div>
              </div>
              <div class="row3">
                <div class="field">
                  <label class="label" for="estimatedMinutes">Estimated (minutes)</label>
                  <input id="estimatedMinutes" type="number" min="0" class="input" formControlName="estimatedMinutes" />
                </div>
                <div class="field">
                  <label class="label" for="actualMinutes">Actual (minutes)</label>
                  <input id="actualMinutes" type="number" min="0" class="input" formControlName="actualMinutes" />
                </div>
              </div>
              <div class="row3">
                <div class="field">
                  <label class="label" for="recurrence">Repeats</label>
                  <select id="recurrence" class="select" formControlName="recurrence">
                    @for (r of recurrences; track r) {
                      <option [value]="r">{{ recurrenceLabel(r) }}</option>
                    }
                  </select>
                </div>
                @if (form.controls.recurrence.value !== 'NONE') {
                  <div class="field">
                    <label class="label" for="recurrenceEndDate">Repeat until</label>
                    <input id="recurrenceEndDate" type="date" class="input" formControlName="recurrenceEndDate" />
                  </div>
                }
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-ghost" (click)="editing.set(false)">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="saving()">
                  {{ saving() ? 'Saving…' : 'Save changes' }}
                </button>
              </div>
            </form>
          } @else {
            <div class="head-top">
              <div>
                <h1>{{ t.title }}</h1>
                <p class="owner">
                  Created by {{ t.ownerName }}
                  @if (t.projectName) {
                    · <a [routerLink]="['/projects', t.projectId]">{{ t.projectName }}</a>
                  }
                </p>
              </div>
              <div class="head-actions">
                <button type="button" class="btn btn-ghost" (click)="startEdit()">Edit</button>
                <button type="button" class="btn btn-danger" (click)="deleteTask()">Delete</button>
              </div>
            </div>

            @if (t.description) {
              <p class="description">{{ t.description }}</p>
            }

            <div class="badges">
              <span class="badge badge-progress">{{ statusLabel(t.status) }}</span>
              <span class="badge badge-med">{{ priorityLabel(t.priority) }}</span>
              @if (t.recurrence !== 'NONE') {
                <span class="badge badge-todo">↻ {{ recurrenceLabel(t.recurrence) }}</span>
              }
            </div>

            <div class="meta-grid">
              @if (t.startDate) {
                <span>Starts {{ formatDate(t.startDate) }}</span>
              }
              @if (t.dueDate) {
                <span>Due {{ formatDate(t.dueDate) }}</span>
              }
              @if (t.estimatedMinutes) {
                <span>Est. {{ formatMinutes(t.estimatedMinutes) }}</span>
              }
              <span>Logged {{ formatMinutes(t.actualMinutes) }}</span>
            </div>
          }
        </section>

        <!-- Assignees & Watchers -->
        <section class="card">
          <h2>Assignees</h2>
          @if (!t.projectId) {
            <p class="muted">Add this task to a project to assign collaborators.</p>
          } @else {
            <ul class="chip-list">
              @for (a of assignees(); track a.userId) {
                <li class="chip">
                  {{ a.name }}
                  <button type="button" class="chip-x" (click)="removeAssignee(a)" aria-label="Remove">×</button>
                </li>
              }
              @if (assignees().length === 0) {
                <span class="muted">No one assigned yet.</span>
              }
            </ul>
            @if (assignableMembers().length > 0) {
              <select class="select picker" (change)="addAssignee($any($event.target).value); $any($event.target).value = ''">
                <option value="" disabled selected>+ Assign someone…</option>
                @for (m of assignableMembers(); track m.userId) {
                  <option [value]="m.userId">{{ m.name }}</option>
                }
              </select>
            }
          }

          <h2 class="mt">Watchers</h2>
          <div class="watch-row">
            <ul class="chip-list">
              @for (w of watchers(); track w.userId) {
                <li class="chip">{{ w.name }}</li>
              }
              @if (watchers().length === 0) {
                <span class="muted">No watchers yet.</span>
              }
            </ul>
            <button type="button" class="btn btn-ghost btn-sm" (click)="toggleWatch()">
              {{ isWatching() ? 'Unwatch' : 'Watch' }}
            </button>
          </div>
        </section>

        <!-- Tags -->
        <section class="card">
          <h2>Tags</h2>
          @if (!t.projectId) {
            <p class="muted">Add this task to a project to use tags.</p>
          } @else {
            <ul class="chip-list">
              @for (tg of taskTags(); track tg.id) {
                <li class="chip" [style.background]="tg.color ?? 'var(--brand-tint)'">
                  {{ tg.name }}
                  <button type="button" class="chip-x" (click)="detachTag(tg)" aria-label="Remove">×</button>
                </li>
              }
              @if (taskTags().length === 0) {
                <span class="muted">No tags yet.</span>
              }
            </ul>
            @if (availableTags().length > 0) {
              <select class="select picker" (change)="attachTag($any($event.target).value); $any($event.target).value = ''">
                <option value="" disabled selected>+ Add a tag…</option>
                @for (tg of availableTags(); track tg.id) {
                  <option [value]="tg.id">{{ tg.name }}</option>
                }
              </select>
            }
          }
        </section>

        <!-- Subtasks -->
        <section class="card">
          <h2>Subtasks @if (subtasks().length) {<span class="muted">({{ completedSubtasks() }}/{{ subtasks().length }})</span>}</h2>
          <ul class="subtask-list">
            @for (s of subtasks(); track s.id) {
              <li>
                <input
                  type="checkbox"
                  [checked]="s.completed"
                  (change)="toggleSubtask(s, $any($event.target).checked)"
                />
                <span [class.done]="s.completed">{{ s.title }}</span>
                <button type="button" class="chip-x" (click)="deleteSubtask(s)" aria-label="Remove">×</button>
              </li>
            }
          </ul>
          <form class="inline-form" (ngSubmit)="addSubtask()" novalidate>
            <input type="text" class="input" placeholder="Add a subtask…" [formControl]="subtaskTitle" />
            <button type="submit" class="btn btn-ghost" [disabled]="!subtaskTitle.value.trim()">Add</button>
          </form>
        </section>

        <!-- Dependencies -->
        <section class="card">
          <h2>Dependencies</h2>
          <div class="dep-col">
            <h3>Blocked by</h3>
            <ul class="chip-list">
              @for (d of dependencies().blockedBy; track d.taskId) {
                <li class="chip">
                  {{ d.title }} <span class="badge badge-todo">{{ statusLabel(d.status) }}</span>
                  <button type="button" class="chip-x" (click)="removeDependency(d.taskId)" aria-label="Remove">×</button>
                </li>
              }
              @if (dependencies().blockedBy.length === 0) {
                <span class="muted">Not blocked by anything.</span>
              }
            </ul>
            @if (candidateDependencies().length > 0) {
              <select class="select picker" (change)="addDependency($any($event.target).value); $any($event.target).value = ''">
                <option value="" disabled selected>+ Mark as blocked by…</option>
                @for (c of candidateDependencies(); track c.id) {
                  <option [value]="c.id">{{ c.title }}</option>
                }
              </select>
            }
          </div>
          <div class="dep-col">
            <h3>Blocks</h3>
            <ul class="chip-list">
              @for (d of dependencies().blocks; track d.taskId) {
                <li class="chip">{{ d.title }} <span class="badge badge-todo">{{ statusLabel(d.status) }}</span></li>
              }
              @if (dependencies().blocks.length === 0) {
                <span class="muted">Not blocking anything.</span>
              }
            </ul>
          </div>
        </section>

        <!-- Comments -->
        <section class="card">
          <h2>Comments</h2>
          <ul class="comment-list">
            @for (c of comments(); track c.id) {
              <li>
                <div class="comment-head">
                  <span class="comment-author">{{ c.authorName }}</span>
                  <span class="comment-time">{{ formatDateTime(c.createdAt) }}@if (c.updatedAt) { (edited)}</span>
                </div>
                <p class="comment-body">{{ c.content }}</p>
              </li>
            }
            @if (comments().length === 0) {
              <p class="muted">No comments yet.</p>
            }
          </ul>

          @if (mentionCandidates().length > 0) {
            <div class="mention-row">
              <span class="muted">Mention:</span>
              @for (m of mentionCandidates(); track m.userId) {
                <button type="button" class="btn btn-ghost btn-sm" (click)="insertMention(m.name)">
                  &#64;{{ m.name }}
                </button>
              }
            </div>
          }
          <form class="inline-form" (ngSubmit)="addComment()" novalidate>
            <textarea class="textarea" rows="2" placeholder="Write a comment…" [formControl]="commentContent"></textarea>
            <button type="submit" class="btn btn-primary" [disabled]="!commentContent.value.trim()">Post</button>
          </form>
        </section>

        <!-- Attachments -->
        <section class="card">
          <h2>Attachments</h2>
          <ul class="attachment-list">
            @for (a of attachments(); track a.id) {
              <li>
                <a [href]="a.fileUrl" target="_blank" rel="noopener">{{ a.fileName }}</a>
                <span class="muted">{{ formatSize(a.sizeBytes) }} · {{ a.uploadedByName }}</span>
                <button type="button" class="chip-x" (click)="deleteAttachment(a)" aria-label="Remove">×</button>
              </li>
            }
            @if (attachments().length === 0) {
              <p class="muted">No attachments yet.</p>
            }
          </ul>
          <button type="button" class="btn btn-ghost" (click)="fileInput.click()" [disabled]="uploading()">
            {{ uploading() ? 'Uploading…' : '+ Upload file' }}
          </button>
          <input #fileInput type="file" style="display:none" (change)="onFileSelected($any($event.target).files)" />
        </section>

        <!-- History -->
        <section class="card">
          <h2>History</h2>
          <ul class="history-list">
            @for (h of history(); track h.id) {
              <li>
                <span class="history-main">{{ h.summary }}</span>
                <span class="history-meta">{{ h.actorName }} · {{ formatDateTime(h.createdAt) }}</span>
              </li>
            }
            @if (history().length === 0) {
              <p class="muted">No history yet.</p>
            }
          </ul>
        </section>
      } @else if (loading()) {
        <div class="state">Loading task…</div>
      }
    </main>
  `,
  styles: [
    `
      .page {
        padding-top: 1.5rem;
        padding-bottom: 4rem;
        max-width: 760px;
      }

      .back {
        display: inline-block;
        font-size: 0.85rem;
        color: var(--muted);
        margin-bottom: 1rem;
      }

      .state {
        text-align: center;
        color: var(--muted);
        padding: 3rem 1rem;
      }

      .card {
        padding: 1.4rem 1.5rem;
        margin-bottom: 1.4rem;
      }

      h2 {
        font-size: 1.05rem;
        margin-bottom: 0.8rem;
      }

      h2.mt {
        margin-top: 1.2rem;
      }

      h3 {
        font-size: 0.9rem;
        color: var(--muted);
        margin-bottom: 0.5rem;
      }

      .head-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 0.8rem;
      }

      .head-top h1 {
        font-size: 1.4rem;
      }

      .head-actions {
        display: flex;
        gap: 0.5rem;
        flex-shrink: 0;
      }

      .owner {
        color: var(--muted);
        font-size: 0.82rem;
        margin: 0.3rem 0 0;
      }

      .description {
        color: var(--ink-2);
        font-size: 0.9rem;
        white-space: pre-wrap;
        margin: 0.8rem 0;
      }

      .badges {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin: 0.8rem 0;
      }

      .meta-grid {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        font-size: 0.82rem;
        color: var(--muted);
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .row3 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
      }

      .muted {
        color: var(--muted);
        font-size: 0.85rem;
      }

      .chip-list {
        list-style: none;
        margin: 0 0 0.8rem;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 0.3rem 0.5rem 0.3rem 0.75rem;
        font-size: 0.82rem;
      }

      .chip-x {
        background: none;
        border: none;
        color: var(--muted);
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        padding: 0 0.2rem;
      }

      .chip-x:hover {
        color: var(--high);
      }

      .picker {
        width: auto;
        max-width: 240px;
      }

      .watch-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .btn-sm {
        padding: 0.4rem 0.6rem;
        font-size: 0.8rem;
      }

      .subtask-list,
      .attachment-list,
      .history-list {
        list-style: none;
        margin: 0 0 1rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .subtask-list li,
      .attachment-list li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.88rem;
      }

      .subtask-list input[type='checkbox'] {
        width: 16px;
        height: 16px;
        accent-color: var(--brand);
      }

      .subtask-list span {
        flex: 1;
      }

      .subtask-list .done {
        text-decoration: line-through;
        color: var(--muted);
      }

      .inline-form {
        display: flex;
        gap: 0.6rem;
        align-items: flex-start;
      }

      .inline-form .input,
      .inline-form .textarea {
        flex: 1;
      }

      .dep-col {
        margin-bottom: 1rem;
      }

      .dep-col:last-child {
        margin-bottom: 0;
      }

      .comment-list {
        list-style: none;
        margin: 0 0 1rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }

      .comment-head {
        display: flex;
        gap: 0.6rem;
        align-items: baseline;
        font-size: 0.82rem;
      }

      .comment-author {
        font-weight: 600;
      }

      .comment-time {
        color: var(--muted);
      }

      .comment-body {
        margin: 0.3rem 0 0;
        font-size: 0.88rem;
        white-space: pre-wrap;
      }

      .mention-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
        margin-bottom: 0.6rem;
      }

      .history-list li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.85rem;
        flex-wrap: wrap;
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.5rem;
      }

      .history-meta {
        color: var(--muted);
        font-size: 0.78rem;
        white-space: nowrap;
      }

      @media (max-width: 560px) {
        .row3 {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class TaskDetailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly taskService = inject(TaskService);
  private readonly detailService = inject(TaskDetailService);
  private readonly projectService = inject(ProjectService);
  private readonly tagService = inject(TagService);

  private taskId!: number;

  readonly statuses = STATUS_OPTIONS;
  readonly priorities = PRIORITY_OPTIONS;
  readonly recurrences = RECURRENCE_OPTIONS;

  readonly task = signal<Task | null>(null);
  readonly loading = signal(true);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly projectMembers = signal<ProjectMember[]>([]);
  readonly workspaceTags = signal<TagRef[]>([]);

  readonly assignees = signal<TaskCollaborator[]>([]);
  readonly watchers = signal<TaskCollaborator[]>([]);
  readonly taskTags = signal<TagRef[]>([]);
  readonly subtasks = signal<Subtask[]>([]);
  readonly dependencies = signal<TaskDependencies>({ blockedBy: [], blocks: [] });
  readonly comments = signal<TaskComment[]>([]);
  readonly attachments = signal<TaskAttachment[]>([]);
  readonly history = signal<TaskHistoryEntry[]>([]);
  readonly uploading = signal(false);

  readonly subtaskTitle = this.fb.nonNullable.control('');
  readonly commentContent = this.fb.nonNullable.control('');

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    status: ['TODO' as TaskStatus],
    priority: ['MEDIUM' as Priority],
    startDate: [''],
    dueDate: [''],
    estimatedMinutes: [null as number | null],
    actualMinutes: [0],
    recurrence: ['NONE' as RecurrenceType],
    recurrenceEndDate: [''],
  });

  readonly isWatching = computed(() => {
    const me = this.auth.user();
    return !!me && this.watchers().some((w) => w.userId === me.id);
  });

  readonly assignableMembers = computed(() =>
    this.projectMembers().filter((m) => !this.assignees().some((a) => a.userId === m.userId))
  );

  readonly availableTags = computed(() =>
    this.workspaceTags().filter((t) => !this.taskTags().some((tt) => tt.id === t.id))
  );

  readonly mentionCandidates = computed(() => this.projectMembers());

  private allProjectTasks = signal<Task[]>([]);
  readonly candidateDependencies = computed(() => {
    const t = this.task();
    if (!t) {
      return [];
    }
    const blockedIds = new Set(this.dependencies().blockedBy.map((d) => d.taskId));
    return this.allProjectTasks().filter((c) => c.id !== t.id && !blockedIds.has(c.id));
  });

  readonly completedSubtasks = computed(() => this.subtasks().filter((s) => s.completed).length);

  ngOnInit(): void {
    this.taskId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadTask();
    this.reloadCollaboration();
    this.detailService.listSubtasks(this.taskId).subscribe({ next: (s) => this.subtasks.set(s) });
    this.detailService.listDependencies(this.taskId).subscribe({ next: (d) => this.dependencies.set(d) });
    this.detailService.listComments(this.taskId).subscribe({ next: (c) => this.comments.set(c) });
    this.detailService.listAttachments(this.taskId).subscribe({ next: (a) => this.attachments.set(a) });
    this.taskService.history(this.taskId, 0, 50).subscribe({ next: (p) => this.history.set(p.content) });
  }

  private loadTask(): void {
    this.loading.set(true);
    this.taskService.get(this.taskId).subscribe({
      next: (t) => {
        this.task.set(t);
        this.loading.set(false);
        if (t.projectId) {
          this.loadProjectContext(t.projectId);
        }
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  private loadProjectContext(projectId: number): void {
    this.projectService.listMembers(projectId).subscribe({ next: (m) => this.projectMembers.set(m) });
    this.projectService.get(projectId).subscribe({
      next: (p) => this.tagService.listForWorkspace(p.workspaceId).subscribe({
        next: (tags) => this.workspaceTags.set(tags),
      }),
    });
    this.projectService.listTasks(projectId, 0, 100).subscribe({
      next: (page) => this.allProjectTasks.set(page.content),
    });
  }

  private reloadCollaboration(): void {
    this.detailService.listAssignees(this.taskId).subscribe({ next: (a) => this.assignees.set(a) });
    this.detailService.listWatchers(this.taskId).subscribe({ next: (w) => this.watchers.set(w) });
    this.detailService.listTaskTags(this.taskId).subscribe({ next: (t) => this.taskTags.set(t) });
  }

  // ---- info edit ----

  startEdit(): void {
    const t = this.task();
    if (!t) {
      return;
    }
    this.form.setValue({
      title: t.title,
      description: t.description ?? '',
      status: t.status,
      priority: t.priority,
      startDate: t.startDate ?? '',
      dueDate: t.dueDate ?? '',
      estimatedMinutes: t.estimatedMinutes,
      actualMinutes: t.actualMinutes,
      recurrence: t.recurrence,
      recurrenceEndDate: t.recurrenceEndDate ?? '',
    });
    this.editing.set(true);
  }

  saveInfo(): void {
    const t = this.task();
    if (!t || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    this.taskService
      .update(t.id, {
        title: raw.title.trim(),
        description: raw.description.trim() || null,
        priority: raw.priority,
        status: raw.status,
        startDate: raw.startDate || null,
        dueDate: raw.dueDate || null,
        estimatedMinutes: raw.estimatedMinutes,
        actualMinutes: raw.actualMinutes,
        recurrence: raw.recurrence,
        recurrenceEndDate: raw.recurrence !== 'NONE' ? raw.recurrenceEndDate || null : null,
        projectId: t.projectId,
      })
      .subscribe({
        next: (updated) => {
          this.task.set(updated);
          this.saving.set(false);
          this.editing.set(false);
          this.success.set('Task updated.');
          this.taskService.history(this.taskId, 0, 50).subscribe({ next: (p) => this.history.set(p.content) });
        },
        error: (err: ApiClientError) => {
          this.error.set(err.message);
          this.saving.set(false);
        },
      });
  }

  deleteTask(): void {
    const t = this.task();
    if (!t || !confirm(`Delete "${t.title}"? This can't be undone.`)) {
      return;
    }
    this.taskService.delete(t.id).subscribe({
      next: () => {
        if (t.projectId) {
          void this.router.navigate(['/projects', t.projectId]);
        } else {
          void this.router.navigate(['/dashboard']);
        }
      },
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  // ---- assignees ----

  addAssignee(userId: string): void {
    if (!userId) {
      return;
    }
    this.detailService.addAssignee(this.taskId, Number(userId)).subscribe({
      next: () => this.reloadCollaboration(),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  removeAssignee(a: TaskCollaborator): void {
    this.detailService.removeAssignee(this.taskId, a.userId).subscribe({
      next: () => this.reloadCollaboration(),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  toggleWatch(): void {
    const refresh = () =>
      this.detailService.listWatchers(this.taskId).subscribe({ next: (w) => this.watchers.set(w) });
    const onError = (err: ApiClientError) => this.error.set(err.message);

    if (this.isWatching()) {
      this.detailService.unwatch(this.taskId).subscribe({ next: refresh, error: onError });
    } else {
      this.detailService.watch(this.taskId).subscribe({ next: refresh, error: onError });
    }
  }

  // ---- tags ----

  attachTag(tagId: string): void {
    if (!tagId) {
      return;
    }
    this.detailService.attachTag(this.taskId, Number(tagId)).subscribe({
      next: () => this.detailService.listTaskTags(this.taskId).subscribe({ next: (t) => this.taskTags.set(t) }),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  detachTag(tag: TagRef): void {
    this.detailService.detachTag(this.taskId, tag.id).subscribe({
      next: () => this.taskTags.set(this.taskTags().filter((t) => t.id !== tag.id)),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  // ---- subtasks ----

  addSubtask(): void {
    const title = this.subtaskTitle.value.trim();
    if (!title) {
      return;
    }
    this.detailService.createSubtask(this.taskId, title).subscribe({
      next: (s) => {
        this.subtasks.set([...this.subtasks(), s]);
        this.subtaskTitle.setValue('');
      },
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  toggleSubtask(subtask: Subtask, completed: boolean): void {
    this.detailService.updateSubtask(this.taskId, subtask.id, subtask.title, completed).subscribe({
      next: (updated) =>
        this.subtasks.set(this.subtasks().map((s) => (s.id === updated.id ? updated : s))),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  deleteSubtask(subtask: Subtask): void {
    this.detailService.deleteSubtask(this.taskId, subtask.id).subscribe({
      next: () => this.subtasks.set(this.subtasks().filter((s) => s.id !== subtask.id)),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  // ---- dependencies ----

  addDependency(dependsOnTaskId: string): void {
    if (!dependsOnTaskId) {
      return;
    }
    this.detailService.addDependency(this.taskId, Number(dependsOnTaskId)).subscribe({
      next: () => this.detailService.listDependencies(this.taskId).subscribe({ next: (d) => this.dependencies.set(d) }),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  removeDependency(dependsOnTaskId: number): void {
    this.detailService.removeDependency(this.taskId, dependsOnTaskId).subscribe({
      next: () => this.detailService.listDependencies(this.taskId).subscribe({ next: (d) => this.dependencies.set(d) }),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  // ---- comments ----

  insertMention(name: string): void {
    const current = this.commentContent.value;
    const separator = current && !current.endsWith(' ') ? ' ' : '';
    this.commentContent.setValue(`${current}${separator}@[${name}] `);
  }

  addComment(): void {
    const content = this.commentContent.value.trim();
    if (!content) {
      return;
    }
    this.detailService.createComment(this.taskId, content).subscribe({
      next: (c) => {
        this.comments.set([...this.comments(), c]);
        this.commentContent.setValue('');
      },
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  // ---- attachments ----

  onFileSelected(files: FileList | null): void {
    const file = files?.[0];
    if (!file) {
      return;
    }
    this.uploading.set(true);
    this.detailService.uploadAttachment(this.taskId, file).subscribe({
      next: (a) => {
        this.attachments.set([a, ...this.attachments()]);
        this.uploading.set(false);
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.uploading.set(false);
      },
    });
  }

  deleteAttachment(attachment: TaskAttachment): void {
    this.detailService.deleteAttachment(this.taskId, attachment.id).subscribe({
      next: () => this.attachments.set(this.attachments().filter((a) => a.id !== attachment.id)),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  // ---- formatting helpers ----

  statusLabel(s: TaskStatus): string {
    return STATUS_LABELS[s];
  }

  priorityLabel(p: Priority): string {
    return PRIORITY_LABELS[p];
  }

  recurrenceLabel(r: RecurrenceType): string {
    return RECURRENCE_LABELS[r];
  }

  formatDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  formatMinutes(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
