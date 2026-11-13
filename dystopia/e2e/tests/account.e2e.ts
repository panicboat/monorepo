import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { RECORDING_TIMEOUT_MS } from './support/act.ts';
import { openReviewsTab, reviewCards, writeReview } from './support/reviews.ts';
import { SEED } from './support/seed.ts';
import { PROFILE_NOT_FOUND_MESSAGE, openProfile, text } from './support/screen.ts';
import { createAccount, signIn, switchToCreated, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const MISSING_GUEST_NAME = '（無効なゲスト）';

describe('account.md / ログイン', () => {
  test('a seeded cast signs in and reaches the home feed', async (fx) => {
    await signIn(fx, SEED.accounts.yuna.phone);
    await expect(fx.browser).toHaveURL('/');
    await fx.app.open(`/u/${SEED.accounts.yuna.username}`);
    await expect(fx.screen.getByText(SEED.posts.yunaPublic, { exact: false, visible: true }).first()).toBeVisible();
  });

  test('a wrong password is rejected with the sign-in error message', async ({ app, screen }) => {
    await app.open('/login');
    await screen.getByLabel('電話番号').fill(SEED.accounts.yuna.phone);
    await screen.getByLabel('パスワード').fill('wrong-password');
    await screen.getByRole('button', 'ログイン').click();
    await expect(screen.getByText('電話番号または認証コードが正しくありません')).toBeVisible();
  });
});

describe('account.md / 登録', () => {
  test('a new guest signs up with the confirmation code and completes onboarding', async (fx) => {
    const account = await createAccount(fx, 'guest');
    await fx.app.open(`/u/${account.username}`);
    await expect(fx.screen.getByText(account.displayName, { visible: true }).first()).toBeVisible();
  });
});

describe('account.md / 退会', () => {
  test('a withdrawn guest is signed out, hidden from others with its review kept under a masked name, and restored by signing in', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const guest = await createAccount(fx, 'guest');
    const note = `e2e review note ${Date.now()}`;
    await writeReview(fx, guest, SEED.accounts.rin, note);

    await fx.app.open('/settings');
    await fx.screen.getByRole('button', '退会する').click();
    await fx.screen.getByRole('dialog').getByRole('button', '退会する').click();
    // The shell sends a signed-out /settings to /login before the push to / lands, so either path marks the sign-out.
    await expect(fx.browser).toHaveURL(/\/(login)?$/);
    await fx.app.open('/settings');
    await expect(fx.browser).toHaveURL('/login');

    await signIn(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, guest.username);
    await expectHiddenAfter(text(fx, PROFILE_NOT_FOUND_MESSAGE), text(fx, guest.displayName));
    await openReviewsTab(fx, SEED.accounts.rin.username);
    const review = reviewCards(fx).filter({ hasText: note });
    await expectHiddenAfter(review.filter({ hasText: MISSING_GUEST_NAME }), text(fx, guest.displayName));

    await switchToCreated(fx, guest);
    await switchUser(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, guest.username);
    await expect(text(fx, guest.displayName)).toBeVisible();
  });
});
