import { describe, test } from '@e2e-dev/web';
import { expect, unique } from 'e2e';
import type { Locator } from 'e2e';
import { RECORDING_TIMEOUT_MS, SIGNED_IN_AS, actFromHome, actorParams, follow, targetParams } from './support/act.ts';
import type { ActFixtures } from './support/act.ts';
import { SEED } from './support/seed.ts';
import type { SeedAccount } from './support/seed.ts';
import { openProfile, text } from './support/screen.ts';
import { createAccount, signIn, switchToCreated, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

// Anchoring on a reviewer's name would pass before the list loads, so the settled locked notice marks the loaded tab.
const LOCKED_MESSAGE = 'フォローすると見られます';

const LOCK_WITHOUT_APPROVAL = `${SIGNED_IN_AS}open the menu, choose プロフィール, tap プロフィールを編集, turn on プロフィールに鍵をかける, turn off フォローを承認制にする, tap 保存, then reopen プロフィールを編集 and check that プロフィールに鍵をかける is on and フォローを承認制にする is off`;
const WRITE_REVIEW = `${SIGNED_IN_AS}open 検索, choose the ユーザー tab, search for {targetHandle}, open the profile of {targetName} (@{targetHandle}) from the result row, open the クチコミ tab, tap このキャストのクチコミを書く, write {note} into the 補足（任意） field, tap クチコミを作成, then open the menu, choose プロフィール, open the クチコミ tab, and check that {note} is listed`;

function reviewCards(fx: ActFixtures): Locator {
  return fx.screen.getByRole('article');
}

async function openReviewsTab(fx: ActFixtures, username: string): Promise<void> {
  await openProfile(fx, username);
  await fx.screen.getByRole('tab', 'クチコミ').click();
}

async function expectReviewsLocked(fx: ActFixtures, username: string): Promise<void> {
  await openReviewsTab(fx, username);
  await expectHiddenAfter(text(fx, LOCKED_MESSAGE), reviewCards(fx));
}

async function createLockedCastWithoutApproval(fx: ActFixtures): Promise<SeedAccount> {
  const cast = await createAccount(fx, 'cast');
  await actFromHome(fx, LOCK_WITHOUT_APPROVAL, { params: actorParams(cast) });
  await openProfile(fx, cast.username);
  await fx.screen.getByRole('button', 'プロフィールを編集').click();
  await expect(fx.screen.getByRole('switch', 'プロフィールに鍵をかける')).toBeChecked();
  await expect(fx.screen.getByRole('switch', 'フォローを承認制にする')).toBeChecked({ checked: false });
  return cast;
}

async function writeReview(fx: ActFixtures, author: SeedAccount, cast: SeedAccount, note: string): Promise<void> {
  await actFromHome(fx, WRITE_REVIEW, { params: { ...actorParams(author), ...targetParams(cast), note: unique(note) } });
  await expect(text(fx, note)).toBeVisible();
}

describe('profiles.md / 鍵とフォローの承認制', () => {
  test('an approved follower sees reviews on a locked profile', async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);
    await openReviewsTab(fx, SEED.accounts.mio.username);
    await expect(reviewCards(fx).filter({ hasText: SEED.accounts.taro.displayName })).toBeVisible();
  });

  test('a non-follower and a pending follower do not see reviews on a locked profile', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await expectReviewsLocked(fx, SEED.accounts.mio.username);

    await switchUser(fx, SEED.accounts.saburo.phone);
    await expectReviewsLocked(fx, SEED.accounts.mio.username);
  });

  test('following a locked profile without approval reveals its reviews at once', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const writer = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const viewer = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createLockedCastWithoutApproval(fx);
    const note = `e2e review note ${Date.now()}`;

    await switchToCreated(fx, writer);
    await writeReview(fx, writer, cast, note);

    await switchToCreated(fx, viewer);
    await expectReviewsLocked(fx, cast.username);
    await expect(text(fx, note)).toHaveCount(0);

    await follow(fx, cast);
    await openReviewsTab(fx, cast.username);
    await expect(fx.screen.getByRole('button', 'メッセージ')).toBeVisible();
    await expect(text(fx, note)).toBeVisible();
  });
});
