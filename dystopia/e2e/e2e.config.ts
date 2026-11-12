import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';

export default {
  projectId: 'dystopia-e2e',
  targets: [
    {
      engine: web({ viewport: { width: 390, height: 844 } }),
      app: { url: process.env.APP_URL ?? 'http://localhost:3055' },
    },
  ],
  agents: {
    default: { model: createAmazonBedrock({ region: 'us-east-1' })('global.anthropic.claude-sonnet-4-6') },
  },
  reporters: ['list', 'junit'],
  ...(process.env.CI === undefined ? {} : { cache: { mode: 'read-write' } }),
} satisfies E2EConfig;
