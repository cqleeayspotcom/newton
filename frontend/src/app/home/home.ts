import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type HealthState = 'checking' | 'ok' | 'down';

@Component({
  selector: 'nf-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly backend = signal<HealthState>('checking');
  protected readonly db = signal<HealthState>('checking');

  ngOnInit(): void {
    this.http.get<{ status: string; db: string }>('/api/health').subscribe({
      next: (r) => {
        this.backend.set(r.status === 'ok' ? 'ok' : 'down');
        this.db.set(r.db === 'ok' ? 'ok' : 'down');
      },
      error: () => {
        this.backend.set('down');
        this.db.set('down');
      },
    });
  }
}
