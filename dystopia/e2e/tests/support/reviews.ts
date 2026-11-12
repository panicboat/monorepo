import { expect, unique } from 'e2e';
import type { Locator } from 'e2e';
import { SIGNED_IN_AS, actFromHome, actorParams, targetParams } from './act.ts';
import type { ActFixtures } from './act.ts';
import type { SeedAccount } from './seed.ts';
import { text } from './screen.ts';

const WRITE_REVIEW = `${SIGNED_IN_AS}open 検索, choose the ユーザー tab, search for {targetHandle}, open the profile of {targetName} (@{targetHandle}) from the result row, open the クチコミ tab, tap このキャストのクチコミを書く, write {note} into the 補足（任意） field, tap クチコミを作成, then open the menu, choose プロフィール, open the クチコミ tab, and check that {note} is listed`;

export function reviewCards(fx: ActFixtures): Locator {
  return fx.screen.getByRole('article');
}

export async function openReviewsTab(fx: ActFixtures, username: string): Promise<void> {
  await fx.app.open(`/u/${username}?tab=reviews`);
}

export async function writeReview(fx: ActFixtures, author: SeedAccount, cast: SeedAccount, note: string): Promise<void> {
  await actFromHome(fx, WRITE_REVIEW, { params: { ...actorParams(author), ...targetParams(cast), note: unique(note) } });
  await expect(text(fx, note)).toBeVisible();
}
