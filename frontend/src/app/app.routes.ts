import { Routes } from '@angular/router';
import { Capture } from './capture/capture';

export const routes: Routes = [
  {
    path: 'scan/front',
    component: Capture,
    title: 'Front view — Newfoot',
  },
];
