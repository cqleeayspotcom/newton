import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): { name: string; status: string; docs: string } {
    return {
      name: 'Newfoot API',
      status: 'ok',
      docs: 'Camera posture analysis + corrective insole POC. See /api/health.',
    };
  }
}
