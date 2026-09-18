import {
  ChangeDetectionStrategy,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal-overlay" (click)="onCancel()">
      <section
        class="modal-panel dialog card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        (click)="$event.stopPropagation()"
      >
        <header class="dialog-head">
          <h2 id="task-form-title">{{ isEdit() ? 'Edit task' : 'New task' }}</h2>
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

          <div class="row">
            <div class="field">
              <label class="label" for="dueDate">Due date</label>
              <input id="dueDate" type="date" class="input" formControlName="dueDate" />
            </div>

            <div class="field">
              <label class="label" for="weight">Weight</label>
              <input
                id="weight"
                type="number"
                min="1"
                class="input"
                formControlName="weight"
                placeholder="100"
              />
              <!-- Weight is what drives weighted progress, so it's worth one line
                   of explanation right where it's entered. -->
              <span class="hint">
                How much this task counts towards its parent's progress. Subtasks
                must fit inside it.
              </span>
            </div>
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
      /* Overlay + panel sizing/animation come from the shared .modal-* classes
         in styles.css, so every dialog behaves identically. */
      .dialog {
        padding: 1.5rem 1.6rem 1.6rem;
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

      .hint {
        font-size: 0.74rem;
        line-height: 1.4;
        color: var(--muted);
      }

      .dialog-foot {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
        margin-top: 0.6rem;
      }

      @media (max-width: 560px) {
        .dialog {
          padding: 1.25rem 1.1rem 1.4rem;
        }
        .row {
          grid-template-columns: 1fr;
        }
        .dialog-foot {
          flex-direction: column-reverse;
        }
        .dialog-foot .btn {
          width: 100%;
        }
      }
    `,
  ],
})
export class TaskFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly task = input<Task | null>(null);
  /** When set, new tasks created from this form are attached to this project. */
  readonly projectId = input<number | null>(null);
  /** When set, the new task is created as a subtask of this task. */
  readonly parentId = input<number | null>(null);
  /** When set (creating only), seeds the status field — e.g. "+ Add" inside a status group. */
  readonly presetStatus = input<TaskStatus | null>(null);
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
    // Blank means "let the server decide": the parent's remaining budget for a
    // subtask, or the default for a top-level task.
    weight: ['' as string | number],
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
        weight: existing.weight,
      });
    } else if (this.presetStatus()) {
      this.form.patchValue({ status: this.presetStatus()! });
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
    const weight = Number.parseInt(String(raw.weight), 10);

    const payload: TaskRequest = {
      title: raw.title.trim(),
      description: raw.description.trim() ? raw.description.trim() : null,
      priority: raw.priority,
      status: raw.status,
      dueDate: raw.dueDate ? raw.dueDate : null,
      projectId: existing ? existing.projectId : this.projectId(),
      // Omitted rather than sent as null, so the server keeps the current weight
      // on edit and picks a sensible default on create.
      weight: Number.isFinite(weight) && weight > 0 ? weight : undefined,
      parentId: existing ? undefined : this.parentId(),
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
