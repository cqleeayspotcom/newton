import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Capture } from './capture/capture';
import { Insole } from './insole/insole';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    title: 'Newfoot — posture analysis & insoles',
  },
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
