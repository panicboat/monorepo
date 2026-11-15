import { expect } from 'e2e';
import type { Locator } from 'e2e';
import type { SeedAccount } from './seed.ts';
import { text } from './screen.ts';
import type { SessionFixtures } from './session.ts';

export function reviewCards(fx: SessionFixtures): Locator {
  return fx.screen.getByRole('article');
}

export async function openReviewsTab(fx: SessionFixtures, username: string): Promise<void> {
  await fx.app.open(`/u/${username}?tab=reviews`);
}

export async function writeReview(fx: SessionFixtures, cast: SeedAccount, note: string): Promise<void> {
  await openReviewsTab(fx, cast.username);
  await fx.screen.getByRole('button', 'このキャストのクチコミを書く').click();
  await fx.screen.getByLabel('補足（任意）').fill(note);
  const submit = fx.screen.getByRole('button', 'クチコミを作成');
  await submit.click();
  // The sheet closes only after the save, and leaving the page earlier could cancel it.
  await expect(submit).toHaveCount(0);
  await openReviewsTab(fx, cast.username);
  await expect(text(fx, note)).toBeVisible();
}
