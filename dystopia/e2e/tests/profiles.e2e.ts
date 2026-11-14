import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { BrowserActFixtures } from './support/act.ts';
import { SEED } from './support/seed.ts';
import { PROFILE_NOT_FOUND_MESSAGE, openProfile, text } from './support/screen.ts';
import { openReviewsTab, reviewCards } from './support/reviews.ts';
import { signIn, signInToProfile, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const LOCKED_MESSAGE = 'フォローすると見られます';
const NO_FOOTPRINTS_MESSAGE = 'あなたを訪問した人はまだいません。';
const NO_THREADS_MESSAGE = 'メッセージはまだありません';
const PROFILE_NOT_PERMITTED = 'profile_not_permitted';

// The screen never sends another account's profile, so the request is made from the signed-in page as a tampered client would.
async function getOwnProfileAs(fx: BrowserActFixtures, profileId: string): Promise<{ status: number; body: string }> {
  return fx.browser.evaluate(async (id: string) => {
    const res = await fetch('/api/profile', { headers: { 'x-profile-id': id } });
    return { status: res.status, body: await res.text() };
  }, profileId);
}

describe('profiles.md / 鍵とフォローの承認制', () => {
  test('a non-follower sees the follow notice in place of the reviews on a locked profile', async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);
    await openReviewsTab(fx, SEED.accounts.mio.username);
    await expect(reviewCards(fx).first()).toBeVisible();

    await switchUser(fx, SEED.accounts.jiro.phone);
    await openReviewsTab(fx, SEED.accounts.mio.username);
    await expectHiddenAfter(text(fx, LOCKED_MESSAGE), reviewCards(fx));
  });
});

describe('profiles.md / 他人から見えるか', () => {
  test('a profile whose account is withdrawn is not shown to others', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.goro.username);
    await expectHiddenAfter(text(fx, PROFILE_NOT_FOUND_MESSAGE), text(fx, SEED.accounts.goro.displayName));
  });

  test('a disabled profile is not shown to others', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.mioKyoto.username);
    await expectHiddenAfter(text(fx, PROFILE_NOT_FOUND_MESSAGE), text(fx, SEED.accounts.mioKyoto.displayName));
  });
});

describe('profiles.md / 使うプロフィールの決まり方', () => {
  test('another profile of the same account sees neither the footprints nor the message threads of the first', async (fx) => {
    await signIn(fx, SEED.accounts.yuna.phone);
    await fx.app.open('/footprints');
    await expect(text(fx, SEED.accounts.taro.displayName)).toBeVisible();
    await fx.app.open('/messages');
    await expect(text(fx, SEED.accounts.taro.displayName)).toBeVisible();

    await fx.app.clearState();
    await signInToProfile(fx, SEED.accounts.yunaOsaka);
    await fx.app.open('/footprints');
    await expectHiddenAfter(text(fx, NO_FOOTPRINTS_MESSAGE), text(fx, SEED.accounts.taro.displayName));
    await fx.app.open('/messages');
    await expectHiddenAfter(text(fx, NO_THREADS_MESSAGE), text(fx, SEED.accounts.taro.displayName));
  });

  test('a request sent as a profile of another account is refused', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    const own = await getOwnProfileAs(fx, SEED.profileIds.jiro);
    expect(own.status).toBe(200);
    expect(own.body).toContain(SEED.accounts.jiro.displayName);

    const other = await getOwnProfileAs(fx, SEED.profileIds.yuna);
    expect(other.status).toBe(403);
    expect(other.body).toContain(PROFILE_NOT_PERMITTED);
    expect(other.body).not.toContain(SEED.accounts.yuna.displayName);
  });
});
