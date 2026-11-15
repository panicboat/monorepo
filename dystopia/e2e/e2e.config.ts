import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

export default {
  projectId: 'dystopia-e2e',
  targets: [
    {
      engine: web({ viewport: { width: 390, height: 844 } }),
      app: { url: process.env.APP_URL ?? 'http://localhost:3055' },
    },
  ],
  reporters: ['list', 'junit'],
} satisfies E2EConfig;
