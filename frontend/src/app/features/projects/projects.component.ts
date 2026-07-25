import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectService } from '../../core/services/project.service';
import { WorkspaceService } from '../../core/services/workspace.service';
import { Project } from '../../core/models/project.model';
import { Workspace } from '../../core/models/workspace.model';
import { ApiClientError } from '../../core/models/api-error';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main class="container page">
      <a class="back" routerLink="/workspaces">← All workspaces</a>

      <section class="page-head">
        <div>
          <h1>{{ workspace()?.name ?? 'Projects' }}</h1>
          @if (workspace(); as w) {
            <p class="count">{{ w.type === 'PERSONAL' ? 'Personal workspace' : 'Team workspace' }}</p>
          }
        </div>
        <button type="button" class="btn btn-primary" (click)="showForm.set(true)">
          + New project
        </button>
      </section>

      @if (error()) {
        <div class="alert alert-error" role="alert">{{ error() }}</div>
      }

      @if (showForm()) {
        <section class="card form-card">
          <h2>Create a project</h2>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label class="label" for="name">Name</label>
              <input id="name" type="text" class="input" formControlName="name" maxlength="150" />
              @if (invalid()) {
                <span class="error-text">Name is required.</span>
              }
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
              <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="creating()">
                {{ creating() ? 'Creating…' : 'Create project' }}
              </button>
            </div>
          </form>
        </section>
      }

      @if (loading()) {
        <div class="state">Loading projects…</div>
      } @else if (projects().length === 0) {
        <div class="state empty card">
          <h3>No projects yet</h3>
          <p>Create your first project to start organizing tasks.</p>
        </div>
      } @else {
        <section class="grid">
          @for (p of projects(); track p.id) {
            <a class="card project-card" [routerLink]="['/projects', p.id]">
              <h3>{{ p.name }}</h3>
              @if (p.description) {
                <p class="desc">{{ p.description }}</p>
              }
              <div class="progress-row">
                <div class="progress-track">
                  <div class="progress-fill" [style.width.%]="p.progressPercentage"></div>
                </div>
                <span class="progress-label">{{ p.progressPercentage }}%</span>
              </div>
              <div class="meta-row">
                <span>{{ p.taskCount }} {{ p.taskCount === 1 ? 'task' : 'tasks' }}</span>
                <span>{{ p.memberCount }} {{ p.memberCount === 1 ? 'member' : 'members' }}</span>
                @if (p.deadline) {
                  <span [class.overdue]="isOverdue(p.deadline)">Due {{ formatDate(p.deadline) }}</span>
                }
              </div>
            </a>
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
      .page {
        padding-top: 1.5rem;
        padding-bottom: 4rem;
      }

      .back {
        display: inline-block;
        font-size: 0.85rem;
        color: var(--muted);
        margin-bottom: 1rem;
      }

      .page-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        margin-bottom: 1.4rem;
        gap: 1rem;
      }

      .page-head h1 {
        font-size: 1.6rem;
      }

      .count {
        color: var(--muted);
        margin: 0.3rem 0 0;
        font-size: 0.88rem;
      }

      .form-card {
        padding: 1.4rem 1.5rem;
        margin-bottom: 1.4rem;
      }

      .form-card h2 {
        font-size: 1.05rem;
        margin-bottom: 1rem;
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

      .state {
        text-align: center;
        color: var(--muted);
        padding: 3rem 1rem;
      }

      .empty {
        padding: 3rem 1.5rem;
      }

      .empty h3 {
        margin-bottom: 0.5rem;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1rem;
      }

      .project-card {
        display: block;
        padding: 1.1rem 1.2rem;
        color: inherit;
        text-decoration: none;
        transition: box-shadow 0.15s ease, transform 0.1s ease;
      }

      .project-card:hover {
        box-shadow: var(--shadow);
        transform: translateY(-2px);
        text-decoration: none;
      }

      h3 {
        font-size: 1.05rem;
        margin-bottom: 0.4rem;
      }

      .desc {
        color: var(--ink-2);
        font-size: 0.86rem;
        margin: 0 0 0.8rem;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .progress-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.7rem;
      }

      .progress-track {
        flex: 1;
        height: 6px;
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
        font-size: 0.78rem;
        color: var(--muted);
        font-weight: 600;
        min-width: 32px;
        text-align: right;
      }

      .meta-row {
        display: flex;
        gap: 0.9rem;
        flex-wrap: wrap;
        font-size: 0.78rem;
        color: var(--muted);
      }

      .meta-row .overdue {
        color: var(--high);
        font-weight: 600;
      }
    `,
  ],
})
export class ProjectsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly workspaceService = inject(WorkspaceService);

  private workspaceId!: number;

  readonly workspace = signal<Workspace | null>(null);
  readonly projects = signal<Project[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly creating = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    deadline: [''],
  });

  ngOnInit(): void {
    this.workspaceId = Number(this.route.snapshot.paramMap.get('workspaceId'));
    this.workspaceService.get(this.workspaceId).subscribe({ next: (w) => this.workspace.set(w) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.projectService.listForWorkspace(this.workspaceId).subscribe({
      next: (list) => {
        this.projects.set(list);
        this.loading.set(false);
      },
      error: (err: ApiClientError) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  invalid(): boolean {
    const c = this.form.controls.name;
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    this.projectService
      .create(this.workspaceId, {
        name: raw.name.trim(),
        description: raw.description.trim() || null,
        deadline: raw.deadline || null,
      })
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.showForm.set(false);
          this.form.reset();
          this.load();
        },
        error: (err: ApiClientError) => {
          this.error.set(err.message);
          this.creating.set(false);
        },
      });
  }

  formatDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  isOverdue(iso: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${iso}T00:00:00`).getTime() < today.getTime();
  }
}
