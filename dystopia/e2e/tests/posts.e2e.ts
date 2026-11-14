import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { RECORDING_TIMEOUT_MS, changeBlock } from './support/act.ts';
import { SEED } from './support/seed.ts';
import { EMPTY_POSTS_MESSAGE, POST_UNAVAILABLE_MESSAGE, openProfile, text } from './support/screen.ts';
import { createAccount, signIn, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

describe('posts.md / 閲覧できる範囲', () => {
  test('a visitor who is not signed in is sent to the sign-in page instead of a profile', async (fx) => {
    await fx.app.open(`/u/${SEED.accounts.yuna.username}`);
    await expect(fx.browser).toHaveURL('/login');
    await expect(fx.screen.getByLabel('電話番号')).toBeVisible();
    await expect(text(fx, SEED.posts.yunaPublic)).toHaveCount(0);
  });

  test('a followers-only post is hidden from a non-follower and from a pending follower', async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);
    await openProfile(fx, SEED.accounts.yuna.username);
    await expect(text(fx, SEED.posts.yunaPrivate)).toBeVisible();
    await openProfile(fx, SEED.accounts.mio.username);
    await expect(text(fx, SEED.posts.mioPrivate)).toBeVisible();

    await switchUser(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.yuna.username);
    await expectHiddenAfter(text(fx, SEED.posts.yunaPublic), text(fx, SEED.posts.yunaPrivate));

    await switchUser(fx, SEED.accounts.saburo.phone);
    await openProfile(fx, SEED.accounts.mio.username);
    await expectHiddenAfter(text(fx, SEED.posts.mioPublic), text(fx, SEED.posts.mioPrivate));
  });
});

describe('posts.md / 時間限定投稿（表示期間）', () => {
  test('a scheduled post and an expired post are hidden from others', async (fx) => {
    await signIn(fx, SEED.accounts.yuna.phone);
    await openProfile(fx, SEED.accounts.yuna.username);
    await expect(text(fx, SEED.posts.yunaScheduled)).toBeVisible();
    await expect(text(fx, SEED.posts.yunaExpired)).toBeVisible();

    await switchUser(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.yuna.username);
    await expectHiddenAfter(text(fx, SEED.posts.yunaPublic), text(fx, SEED.posts.yunaScheduled));
    await expect(text(fx, SEED.posts.yunaExpired)).toHaveCount(0);
  });
});

describe('posts.md / いいね', () => {
  test("another profile's liked posts are not shown", async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);
    await fx.app.open(`/u/${SEED.accounts.taro.username}?tab=likes`);
    await expect(fx.screen.getByRole('article').first()).toBeVisible();

    await switchUser(fx, SEED.accounts.jiro.phone);
    await fx.app.open(`/u/${SEED.accounts.taro.username}?tab=likes`);
    // taro has no posts, so any card in the settled posts pane would come from the likes list.
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), fx.screen.getByRole('article'));
    await expect(fx.screen.getByRole('tab', 'いいね')).toHaveCount(0);
  });
});

describe('posts.md / 引用', () => {
  test('a viewer who blocks the original author sees the quote frame as unavailable', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const viewer = await createAccount(fx, 'guest');
    const quote = fx.screen.getByRole('article').filter({ hasText: SEED.posts.rinQuote });

    await openProfile(fx, SEED.accounts.rin.username);
    await expect(quote.filter({ hasText: SEED.posts.yunaPublic })).toBeVisible();

    await changeBlock(fx, viewer, SEED.accounts.yuna, 'ブロック');
    await openProfile(fx, SEED.accounts.rin.username);
    await expectHiddenAfter(quote.filter({ hasText: POST_UNAVAILABLE_MESSAGE }), text(fx, SEED.posts.yunaPublic));
  });
});
