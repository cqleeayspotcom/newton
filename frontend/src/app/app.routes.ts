import { Routes } from '@angular/router';
import { Capture } from './capture/capture';
import { Insole } from './insole/insole';

export const routes: Routes = [
  {
    path: 'scan/front',
    component: Capture,
    title: 'Front view — Newfoot',
  },
  {
    path: 'insole',
    component: Insole,
    title: 'Your insole — Newfoot',
  },
];
