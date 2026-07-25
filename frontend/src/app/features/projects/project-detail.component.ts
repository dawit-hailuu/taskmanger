import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import {
  Project,
  ProjectMember,
  ProjectRole,
  PROJECT_ROLES,
  canManageProject,
} from '../../core/models/project.model';
import { PRIORITY_LABELS, STATUS_LABELS, Task, TaskRequest } from '../../core/models/task.model';
import { ApiClientError } from '../../core/models/api-error';
import { TaskFormComponent } from '../dashboard/task-form.component';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TaskFormComponent],
  template: `
    <main class="container page">
      @if (project(); as p) {
        <a class="back" [routerLink]="['/workspaces', p.workspaceId, 'projects']">← Back to projects</a>

        @if (error()) {
          <div class="alert alert-error" role="alert">{{ error() }}</div>
        }
        @if (success()) {
          <div class="alert alert-success" role="status">{{ success() }}</div>
        }

        <section class="card head-card">
          @if (editing()) {
            <form [formGroup]="form" (ngSubmit)="saveInfo()" novalidate>
              <div class="field">
                <label class="label" for="name">Name</label>
                <input id="name" type="text" class="input" formControlName="name" maxlength="150" />
              </div>
              <div class="field">
                <label class="label" for="description">Description</label>
                <textarea id="description" class="textarea" formControlName="description"></textarea>
              </div>
              <div class="field">
                <label class="label" for="deadline">Deadline</label>
                <input id="deadline" type="date" class="input" formControlName="deadline" />
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
                <h1>{{ p.name }}</h1>
                @if (p.description) {
                  <p class="desc">{{ p.description }}</p>
                }
              </div>
              @if (canManage()) {
                <button type="button" class="btn btn-ghost" (click)="startEdit()">Edit</button>
              }
            </div>

            <div class="progress-row">
              <div class="progress-track">
                <div class="progress-fill" [style.width.%]="p.progressPercentage"></div>
              </div>
              <span class="progress-label">{{ p.progressPercentage }}% complete</span>
            </div>

            <div class="meta-row">
              <span>{{ p.taskCount }} {{ p.taskCount === 1 ? 'task' : 'tasks' }}</span>
              <span>{{ p.memberCount }} {{ p.memberCount === 1 ? 'member' : 'members' }}</span>
              @if (p.deadline) {
                <span>Due {{ formatDate(p.deadline) }}</span>
              }
            </div>
          }
        </section>

        <!-- Members -->
        <section class="card">
          <h2>Members</h2>

          <ul class="member-list">
            @for (m of members(); track m.userId) {
              <li>
                <span class="member-name">{{ m.name }}</span>
                <span class="member-email">{{ m.email }}</span>
                @if (canOwn()) {
                  <select
                    class="select role-select"
                    [value]="m.role"
                    (change)="changeRole(m, $any($event.target).value)"
                  >
                    @for (r of roles; track r) {
                      <option [value]="r">{{ r }}</option>
                    }
                  </select>
                } @else {
                  <span class="badge badge-todo">{{ m.role }}</span>
                }
                @if (canManage()) {
                  <button type="button" class="btn btn-ghost btn-sm" (click)="removeMember(m)">Remove</button>
                }
              </li>
            }
          </ul>

          @if (canManage()) {
            <form class="add-member-form" [formGroup]="memberForm" (ngSubmit)="addMember()" novalidate>
              <input
                type="email"
                class="input"
                placeholder="Add member by email"
                formControlName="email"
              />
              <select class="select" formControlName="role">
                @for (r of roles; track r) {
                  <option [value]="r">{{ r }}</option>
                }
              </select>
              <button type="submit" class="btn btn-primary" [disabled]="addingMember()">
                {{ addingMember() ? 'Adding…' : 'Add' }}
              </button>
            </form>
          }
        </section>

        <!-- Tasks -->
        <section class="card">
          <div class="tasks-head">
            <h2>Tasks</h2>
            <button type="button" class="btn btn-primary btn-sm" (click)="showTaskForm.set(true)">
              + Add task
            </button>
          </div>

          @if (tasks().length === 0 && !loadingTasks()) {
            <p class="muted">No tasks in this project yet.</p>
          } @else {
            <ul class="task-list">
              @for (t of tasks(); track t.id) {
                <li>
                  <span class="task-title"><a [routerLink]="['/tasks', t.id]">{{ t.title }}</a></span>
                  <span class="badge badge-todo">{{ statusLabel(t.status) }}</span>
                  <span class="badge badge-med">{{ priorityLabel(t.priority) }}</span>
                </li>
              }
            </ul>
            @if (hasMoreTasks()) {
              <button type="button" class="btn btn-ghost" (click)="loadMoreTasks()" [disabled]="loadingTasks()">
                {{ loadingTasks() ? 'Loading…' : 'Load more' }}
              </button>
            }
          }
        </section>

        @if (showTaskForm()) {
          <app-task-form
            [projectId]="p.id"
            (saved)="onTaskSaved($event)"
            (cancelled)="showTaskForm.set(false)"
          />
        }
      } @else if (loading()) {
        <div class="state">Loading project…</div>
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

      .head-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .head-top h1 {
        font-size: 1.5rem;
      }

      .desc {
        color: var(--ink-2);
        margin: 0.4rem 0 0;
        font-size: 0.9rem;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
      }

      .progress-row {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        margin-bottom: 0.6rem;
      }

      .progress-track {
        flex: 1;
        height: 8px;
        border-radius: 999px;
        background: var(--border);
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: var(--brand);
        border-radius: 999px;
      }

      .progress-label {
        font-size: 0.82rem;
        color: var(--muted);
        font-weight: 600;
        white-space: nowrap;
      }

      .meta-row {
        display: flex;
        gap: 1rem;
        font-size: 0.82rem;
        color: var(--muted);
      }

      h2 {
        font-size: 1.05rem;
        margin-bottom: 1rem;
      }

      .member-list,
      .task-list {
        list-style: none;
        margin: 0 0 1rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }

      .member-list li,
      .task-list li {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.88rem;
        flex-wrap: wrap;
        padding: 0.4rem 0;
        border-bottom: 1px solid var(--border);
      }

      .member-name {
        font-weight: 600;
      }

      .member-email {
        color: var(--muted);
        font-size: 0.82rem;
        flex: 1;
      }

      .role-select {
        width: auto;
        font-size: 0.8rem;
        padding: 0.35rem 0.5rem;
      }

      .add-member-form {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .add-member-form .input {
        flex: 1 1 200px;
      }

      .add-member-form .select {
        width: auto;
      }

      .tasks-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .task-title {
        flex: 1;
        font-weight: 500;
      }

      .muted {
        color: var(--muted);
        font-size: 0.88rem;
      }

      .btn-sm {
        padding: 0.4rem 0.6rem;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class ProjectDetailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly taskService = inject(TaskService);

  private projectId!: number;
  readonly roles = PROJECT_ROLES;

  readonly project = signal<Project | null>(null);
  readonly members = signal<ProjectMember[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly loading = signal(true);
  readonly loadingTasks = signal(false);
  readonly hasMoreTasks = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly addingMember = signal(false);
  readonly showTaskForm = signal(false);

  private taskPage = 0;

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    deadline: [''],
  });

  readonly memberForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['MEMBER' as ProjectRole, [Validators.required]],
  });

  ngOnInit(): void {
    this.projectId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadProject();
    this.loadMembers();
    this.loadMoreTasks();
  }

  /**
   * A null myRole means the caller has implicit workspace ADMIN/OWNER access
   * (the backend only omits an explicit role in that case) — which always
   * carries manage rights, so treat it the same as an explicit manager role.
   */
  canManage(): boolean {
    const p = this.project();
    return !!p && (p.myRole === null || canManageProject(p.myRole));
  }

  canOwn(): boolean {
    const p = this.project();
    return !!p && (p.myRole === null || p.myRole === 'OWNER');
  }

  loadProject(): void {
    this.loading.set(true);
    this.projectService.get(this.projectId).subscribe({
      next: (p) => {
        this.project.set(p);
        this.loading.set(false);
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  loadMembers(): void {
    this.projectService.listMembers(this.projectId).subscribe({
      next: (list) => this.members.set(list),
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  loadMoreTasks(): void {
    this.loadingTasks.set(true);
    this.projectService.listTasks(this.projectId, this.taskPage, 20).subscribe({
      next: (page) => {
        this.tasks.set([...this.tasks(), ...page.content]);
        this.hasMoreTasks.set(!page.last);
        this.taskPage++;
        this.loadingTasks.set(false);
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.loadingTasks.set(false);
      },
    });
  }

  startEdit(): void {
    const p = this.project();
    if (!p) {
      return;
    }
    this.form.patchValue({
      name: p.name,
      description: p.description ?? '',
      deadline: p.deadline ?? '',
    });
    this.editing.set(true);
  }

  saveInfo(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    this.projectService
      .update(this.projectId, {
        name: raw.name.trim(),
        description: raw.description.trim() || null,
        deadline: raw.deadline || null,
      })
      .subscribe({
        next: (p) => {
          this.project.set(p);
          this.saving.set(false);
          this.editing.set(false);
          this.success.set('Project updated.');
        },
        error: (err: ApiClientError) => {
          this.error.set(err.message);
          this.saving.set(false);
        },
      });
  }

  addMember(): void {
    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }
    this.addingMember.set(true);
    this.error.set(null);

    const raw = this.memberForm.getRawValue();
    this.projectService.addMember(this.projectId, raw.email.trim(), raw.role).subscribe({
      next: (member) => {
        this.members.set([...this.members(), member]);
        this.memberForm.reset({ email: '', role: 'MEMBER' });
        this.addingMember.set(false);
        this.loadProject();
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.addingMember.set(false);
      },
    });
  }

  removeMember(member: ProjectMember): void {
    const confirmed = confirm(`Remove ${member.name} from this project?`);
    if (!confirmed) {
      return;
    }
    this.projectService.removeMember(this.projectId, member.userId).subscribe({
      next: () => {
        this.members.set(this.members().filter((m) => m.userId !== member.userId));
        this.loadProject();
      },
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  changeRole(member: ProjectMember, role: ProjectRole): void {
    this.projectService.changeMemberRole(this.projectId, member.userId, role).subscribe({
      next: (updated) => {
        this.members.set(this.members().map((m) => (m.userId === updated.userId ? updated : m)));
      },
      error: (err: ApiClientError) => this.error.set(err.message),
    });
  }

  onTaskSaved(payload: TaskRequest): void {
    this.taskService.create(payload).subscribe({
      next: () => {
        this.showTaskForm.set(false);
        this.tasks.set([]);
        this.taskPage = 0;
        this.loadMoreTasks();
        this.loadProject();
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.showTaskForm.set(false);
      },
    });
  }

  priorityLabel(p: Task['priority']): string {
    return PRIORITY_LABELS[p];
  }

  statusLabel(s: Task['status']): string {
    return STATUS_LABELS[s];
  }

  formatDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
