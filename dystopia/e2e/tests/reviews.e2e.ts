import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { Locator } from 'e2e';
import { RECORDING_TIMEOUT_MS, SIGNED_IN_AS, actFromHome, actorParams } from './support/act.ts';
import type { ActFixtures } from './support/act.ts';
import { openReviewsTab, reviewCards, writeReview } from './support/reviews.ts';
import { SEED } from './support/seed.ts';
import type { SeedAccount } from './support/seed.ts';
import { openProfile, text } from './support/screen.ts';
import { createAccount, signIn, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const HIDDEN_GUEST_NAME = '（非公開のゲスト）';
const WRITE_REVIEW_BUTTON = 'このキャストのクチコミを書く';

const LOCK_PROFILE = `${SIGNED_IN_AS}open the menu, choose プロフィール, tap プロフィールを編集, turn on プロフィールに鍵をかける, tap 保存, then reopen プロフィールを編集 and check that プロフィールに鍵をかける is on`;

// The item under test is the absent one, so the seed review marks the loaded tab.
function seedReviewCard(fx: ActFixtures): Locator {
  return reviewCards(fx).filter({ hasText: SEED.accounts.shiro.displayName });
}

function writeReviewButton(fx: ActFixtures): Locator {
  return fx.screen.getByRole('button', WRITE_REVIEW_BUTTON);
}

async function createLockedGuest(fx: ActFixtures): Promise<SeedAccount> {
  const guest = await createAccount(fx, 'guest');
  await actFromHome(fx, LOCK_PROFILE, { params: actorParams(guest) });
  await openProfile(fx, guest.username);
  await fx.screen.getByRole('button', 'プロフィールを編集').click();
  await expect(fx.screen.getByRole('switch', 'プロフィールに鍵をかける')).toBeChecked();
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
  test("a locked guest's review shows the body but hides the name from non-followers", { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const author = await createLockedGuest(fx);
    const note = `e2e review note ${Date.now()}`;
    await writeReview(fx, author, SEED.accounts.rin, note);

    await switchUser(fx, SEED.accounts.jiro.phone);
    await openReviewsTab(fx, SEED.accounts.rin.username);
    const review = reviewCards(fx).filter({ hasText: note });
    await expectHiddenAfter(review.filter({ hasText: HIDDEN_GUEST_NAME }), text(fx, author.displayName));
  });
});
