import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';

type HealthState = 'checking' | 'ok' | 'down';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly title = signal('Newfoot');
  protected readonly backend = signal<HealthState>('checking');
  protected readonly db = signal<HealthState>('checking');

  ngOnInit(): void {
    // Skeleton wiring check: proves frontend -> /api reverse-proxy -> DB.
    this.http.get<{ status: string; db: string }>('/api/health').subscribe({
      next: (res) => {
        this.backend.set(res.status === 'ok' ? 'ok' : 'down');
        this.db.set(res.db === 'ok' ? 'ok' : 'down');
      },
      error: () => {
        this.backend.set('down');
        this.db.set('down');
      },
    });
  }
}
