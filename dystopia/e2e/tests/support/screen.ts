import type { Locator } from 'e2e';
import type { SeedAccount } from './seed.ts';
import type { SessionFixtures } from './session.ts';

// Anchoring on the display name would pass before the post list loads, so wait for the settled empty list.
export const EMPTY_POSTS_MESSAGE = 'まだ投稿はありません';

export function text(fx: SessionFixtures, value: string): Locator {
  return fx.screen.getByText(value, { exact: false, visible: true }).first();
}

export async function openProfile(fx: SessionFixtures, username: string): Promise<void> {
  await fx.app.open(`/u/${username}`);
}

export function handle(fx: SessionFixtures, account: SeedAccount): Locator {
  return text(fx, `@${account.username}`);
}
