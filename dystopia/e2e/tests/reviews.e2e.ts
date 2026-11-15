import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { Locator } from 'e2e';
import { openReviewsTab, reviewCards, writeReview } from './support/reviews.ts';
import { SEED } from './support/seed.ts';
import type { SeedAccount } from './support/seed.ts';
import { openProfile, text } from './support/screen.ts';
import { createAccount, signIn, switchUser } from './support/session.ts';
import type { SessionFixtures } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const HIDDEN_GUEST_NAME = '（非公開のゲスト）';
const WRITE_REVIEW_BUTTON = 'このキャストのクチコミを書く';

// The item under test is the absent one, so the seed review marks the loaded tab.
function seedReviewCard(fx: SessionFixtures): Locator {
  return reviewCards(fx).filter({ hasText: SEED.accounts.shiro.displayName });
}

function writeReviewButton(fx: SessionFixtures): Locator {
  return fx.screen.getByRole('button', WRITE_REVIEW_BUTTON);
}

async function createLockedGuest(fx: SessionFixtures): Promise<SeedAccount> {
  const guest = await createAccount(fx, 'guest');
  const edit = fx.screen.getByRole('button', 'プロフィールを編集');
  const lock = fx.screen.getByRole('switch', 'プロフィールに鍵をかける');
  await openProfile(fx, guest.username);
  await edit.click();
  await lock.click();
  await fx.screen.getByRole('button', '保存').click();
  await expect(lock).toHaveCount(0);
  await openProfile(fx, guest.username);
  await edit.click();
  await expect(lock).toBeChecked();
  return guest;
}

describe('reviews.md / 作成', () => {
  test('a cast cannot write a review', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openReviewsTab(fx, SEED.accounts.rin.username);
    await expect(writeReviewButton(fx)).toBeVisible();

    await switchUser(fx, SEED.accounts.yuna.phone);
    await openReviewsTab(fx, SEED.accounts.rin.username);
    await expectHiddenAfter(seedReviewCard(fx), writeReviewButton(fx));
  });
});

describe('reviews.md / 鍵付きのゲストの名前', () => {
  test("a locked guest's review shows the body but hides the name from non-followers", async (fx) => {
    const author = await createLockedGuest(fx);
    const note = `e2e review note ${Date.now()}`;
    await writeReview(fx, SEED.accounts.rin, note);
    const review = reviewCards(fx).filter({ hasText: note });

    await switchUser(fx, SEED.accounts.rin.phone);
    await openReviewsTab(fx, SEED.accounts.rin.username);
    await expect(review.filter({ hasText: author.displayName })).toBeVisible();

    await switchUser(fx, SEED.accounts.jiro.phone);
    await openReviewsTab(fx, SEED.accounts.rin.username);
    await expectHiddenAfter(review.filter({ hasText: HIDDEN_GUEST_NAME }), text(fx, author.displayName));
  });
});
