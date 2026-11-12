import { expect, unique } from 'e2e';
import type { Locator } from 'e2e';
import { SIGNED_IN_AS, actFromHome, actorParams, targetParams } from './act.ts';
import type { ActFixtures } from './act.ts';
import type { SeedAccount } from './seed.ts';
import { text } from './screen.ts';
import type { SessionFixtures } from './session.ts';

export const BLOCKED_NOTICE = 'この相手とはメッセージを送受信できません';
export const FOLLOW_REQUIRED_NOTICE = '相手をフォローするとメッセージを送れます';

const THREAD_HREF_PREFIX = '/messages/';

const SEND_FROM_PROFILE = `${SIGNED_IN_AS}open 検索, choose the ユーザー tab, search for {targetHandle}, open the profile of {targetName} (@{targetHandle}) from the result row, tap メッセージ, write {body} into メッセージ本文, tap 送信, and check that {body} is listed`;
const REPLY_IN_THREAD = `${SIGNED_IN_AS}open メッセージ, open the thread with {targetName}, write {body} into メッセージ本文, tap 送信, and check that {body} is listed`;

export function messageInput(fx: SessionFixtures): Locator {
  return fx.screen.getByLabel('メッセージ本文');
}

export async function sendFromProfile(fx: ActFixtures, sender: SeedAccount, recipient: SeedAccount, body: string): Promise<void> {
  await actFromHome(fx, SEND_FROM_PROFILE, { params: { ...actorParams(sender), ...targetParams(recipient), body: unique(body) } });
  await expect(text(fx, body)).toBeVisible();
}

// The thread link is named by the last message, so it is a param too or the recording misses on every run.
export async function replyInThread(
  fx: ActFixtures,
  sender: SeedAccount,
  counterpart: SeedAccount,
  body: string,
  lastMessage: string,
): Promise<void> {
  await actFromHome(fx, REPLY_IN_THREAD, {
    params: { ...actorParams(sender), ...targetParams(counterpart), body: unique(body), lastMessage: unique(lastMessage) },
  });
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
