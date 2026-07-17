import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    // Flush the health request the component fires on init.
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/health').flush({ status: 'ok', db: 'ok' });
    httpMock.verify();
  });

  it('should render the Newfoot title', async () => {
    const fixture = TestBed.createComponent(App);
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne('/api/health').flush({ status: 'ok', db: 'ok' });
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Newfoot');
  });
});
