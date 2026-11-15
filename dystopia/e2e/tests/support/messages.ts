import { expect } from 'e2e';
import type { Locator } from 'e2e';
import type { SeedAccount } from './seed.ts';
import { openProfile, text } from './screen.ts';
import type { SessionFixtures } from './session.ts';

export const BLOCKED_NOTICE = 'この相手とはメッセージを送受信できません';
export const FOLLOW_REQUIRED_NOTICE = '相手をフォローするとメッセージを送れます';

const THREAD_HREF_PREFIX = '/messages/';

export function messageInput(fx: SessionFixtures): Locator {
  return fx.screen.getByLabel('メッセージ本文');
}

export async function sendFromProfile(fx: SessionFixtures, recipient: SeedAccount, body: string): Promise<void> {
  await openProfile(fx, recipient.username);
  await fx.screen.getByRole('button', 'メッセージ').click();
  await messageInput(fx).fill(body);
  await fx.screen.getByRole('button', '送信').click();
  await expect(text(fx, body)).toBeVisible();
}

// The row also links to the profile, so the thread link is told apart by its href.
export async function openThread(fx: SessionFixtures, counterpart: SeedAccount): Promise<void> {
  await fx.app.open('/messages');
  const row = fx.screen.getByRole('article').filter({ hasText: counterpart.displayName });
  await expect(row).toBeVisible();
  for (const link of await row.getByRole('link').all()) {
    if ((await link.getAttribute('href'))?.startsWith(THREAD_HREF_PREFIX)) {
      await link.click();
      // The restriction defaults to none until the thread loads, so wait for the counterpart's name in the heading.
      await expect(fx.screen.getByRole('heading', /とのメッセージ/).filter({ hasText: counterpart.displayName })).toBeVisible();
      return;
    }
  }
  throw new Error(`the row for ${counterpart.displayName} has no link to a thread`);
}
