import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  PRIORITY_LABELS,
  PRIORITY_OPTIONS,
  Priority,
  STATUS_LABELS,
  STATUS_OPTIONS,
  Task,
  TaskRequest,
  TaskStatus,
} from '../../core/models/task.model';

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="overlay" (click)="onCancel()">
      <section
        class="dialog card"
        role="dialog"
        aria-modal="true"
        (click)="$event.stopPropagation()"
      >
        <header class="dialog-head">
          <h2>{{ isEdit() ? 'Edit task' : 'New task' }}</h2>
          <button
            type="button"
            class="btn btn-ghost btn-icon"
            aria-label="Close"
            (click)="onCancel()"
          >
            ✕
          </button>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label class="label" for="title">Title</label>
            <input
              id="title"
              type="text"
              class="input"
              formControlName="title"
              placeholder="What needs doing?"
              maxlength="150"
            />
            @if (invalid('title')) {
              <span class="error-text">Title is required.</span>
            }
          </div>

          <div class="field">
            <label class="label" for="description">Description</label>
            <textarea
              id="description"
              class="textarea"
              formControlName="description"
              placeholder="Add any details (optional)"
            ></textarea>
          </div>

          <div class="row">
            <div class="field">
              <label class="label" for="priority">Priority</label>
              <select id="priority" class="select" formControlName="priority">
                @for (p of priorities; track p) {
                  <option [value]="p">{{ priorityLabel(p) }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label class="label" for="status">Status</label>
              <select id="status" class="select" formControlName="status">
                @for (s of statuses; track s) {
                  <option [value]="s">{{ statusLabel(s) }}</option>
                }
              </select>
            </div>
          </div>

          <div class="field">
            <label class="label" for="dueDate">Due date</label>
            <input
              id="dueDate"
              type="date"
              class="input"
              formControlName="dueDate"
            />
          </div>

          <footer class="dialog-foot">
            <button type="button" class="btn btn-ghost" (click)="onCancel()">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              {{ isEdit() ? 'Save changes' : 'Create task' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  `,
  styles: [
    `
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(17, 22, 34, 0.5);
        backdrop-filter: blur(2px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 4rem 1.25rem 2rem;
        z-index: 50;
        overflow-y: auto;
        animation: fade 0.15s ease;
      }

      .dialog {
        width: 100%;
        max-width: 520px;
        padding: 1.5rem 1.6rem 1.6rem;
        animation: rise 0.18s ease;
      }

      .dialog-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.2rem;
      }

      h2 { font-size: 1.2rem; }

      form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .dialog-foot {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
        margin-top: 0.6rem;
      }

      @media (max-width: 480px) {
        .row {
          grid-template-columns: 1fr;
        }
        .overlay {
          padding-top: 2rem;
        }
      }

      @keyframes fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes rise {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `,
  ],
})
export class TaskFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly task = input<Task | null>(null);
  /** When set, new tasks created from this form are attached to this project. */
  readonly projectId = input<number | null>(null);
  readonly saved = output<TaskRequest>();
  readonly cancelled = output<void>();

  readonly priorities = PRIORITY_OPTIONS;
  readonly statuses = STATUS_OPTIONS;

  private readonly _isEdit = signal(false);
  readonly isEdit = computed(() => this._isEdit());

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    priority: ['MEDIUM' as Priority, [Validators.required]],
    status: ['TODO' as TaskStatus, [Validators.required]],
    dueDate: [''],
  });

  ngOnInit(): void {
    const existing = this.task();
    if (existing) {
      this._isEdit.set(true);
      this.form.patchValue({
        title: existing.title,
        description: existing.description ?? '',
        priority: existing.priority,
        status: existing.status,
        dueDate: existing.dueDate ?? '',
      });
    }
  }

  invalid(control: 'title'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  priorityLabel(p: Priority): string {
    return PRIORITY_LABELS[p];
  }

  statusLabel(s: TaskStatus): string {
    return STATUS_LABELS[s];
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const existing = this.task();
    const payload: TaskRequest = {
      title: raw.title.trim(),
      description: raw.description.trim() ? raw.description.trim() : null,
      priority: raw.priority,
      status: raw.status,
      dueDate: raw.dueDate ? raw.dueDate : null,
      projectId: existing ? existing.projectId : this.projectId(),
    };
    this.saved.emit(payload);
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onCancel();
  }
}
