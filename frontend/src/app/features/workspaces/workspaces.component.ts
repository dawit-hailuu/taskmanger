import { Component, OnInit, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WorkspaceService } from '../../core/services/workspace.service';
import { Workspace } from '../../core/models/workspace.model';
import { ApiClientError } from '../../core/models/api-error';

@Component({
  selector: 'app-workspaces',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgClass],
  template: `
    <main class="container page">
      <section class="page-head">
        <h1>Workspaces</h1>
        <button type="button" class="btn btn-primary" (click)="showForm.set(true)">
          + New team workspace
        </button>
      </section>

      @if (error()) {
        <div class="alert alert-error" role="alert">{{ error() }}</div>
      }

      @if (showForm()) {
        <section class="card form-card">
          <h2>Create a team workspace</h2>
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
              <textarea id="description" class="textarea" formControlName="description" maxlength="500"></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-ghost" (click)="showForm.set(false)">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="creating()">
                {{ creating() ? 'Creating…' : 'Create workspace' }}
              </button>
            </div>
          </form>
        </section>
      }

      @if (loading()) {
        <div class="state">Loading your workspaces…</div>
      } @else {
        <section class="grid">
          @for (w of workspaces(); track w.id) {
            <a class="card workspace-card" [routerLink]="['/workspaces', w.id, 'projects']">
              <div class="workspace-top">
                <span class="badge" [ngClass]="w.type === 'PERSONAL' ? 'badge-progress' : 'badge-todo'">
                  {{ w.type === 'PERSONAL' ? 'Personal' : 'Team' }}
                </span>
                <span class="role">{{ roleLabel(w.myRole) }}</span>
              </div>
              <h3>{{ w.name }}</h3>
              @if (w.description) {
                <p class="desc">{{ w.description }}</p>
              }
              <p class="meta">{{ w.memberCount }} {{ w.memberCount === 1 ? 'member' : 'members' }}</p>
            </a>
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
      .page {
        padding-top: 2rem;
        padding-bottom: 4rem;
      }

      .page-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.4rem;
      }

      .page-head h1 {
        font-size: 1.7rem;
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

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1rem;
      }

      .workspace-card {
        display: block;
        padding: 1.1rem 1.2rem;
        color: inherit;
        text-decoration: none;
        transition: box-shadow 0.15s ease, transform 0.1s ease;
      }

      .workspace-card:hover {
        box-shadow: var(--shadow);
        transform: translateY(-2px);
        text-decoration: none;
      }

      .workspace-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.6rem;
      }

      .role {
        font-size: 0.75rem;
        color: var(--muted);
        font-weight: 600;
        text-transform: uppercase;
      }

      h3 {
        font-size: 1.05rem;
        margin-bottom: 0.4rem;
      }

      .desc {
        color: var(--ink-2);
        font-size: 0.88rem;
        margin: 0 0 0.6rem;
      }

      .meta {
        color: var(--muted);
        font-size: 0.8rem;
        margin: 0;
      }
    `,
  ],
})
export class WorkspacesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly workspaceService = inject(WorkspaceService);

  readonly workspaces = signal<Workspace[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly creating = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.workspaceService.list().subscribe({
      next: (list) => {
        this.workspaces.set(list);
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
    this.workspaceService
      .create({ name: raw.name.trim(), description: raw.description.trim() || null })
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

  roleLabel(role: string): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
  }
}
