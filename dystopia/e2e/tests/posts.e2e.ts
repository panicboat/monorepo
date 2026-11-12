import { describe, test } from '@e2e-dev/web';
import { expect, unique } from 'e2e';
import { SEED } from './support/seed.ts';
import { EMPTY_POSTS_MESSAGE, openProfile, text } from './support/screen.ts';
import { createAccount, signIn, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

// A fixed far-future instant keeps the instruction params stable, so the recording is reused across days.
const SCHEDULED_START = '2099-12-31T12:00';

describe('posts.md / 閲覧できる範囲', () => {
  test('a non-follower sees 全員 posts but not フォロワーのみ posts', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.yuna.username);
    await expectHiddenAfter(text(fx, SEED.posts.yunaPublic), text(fx, SEED.posts.yunaFollowers));
  });

  test('an approved follower sees フォロワーのみ posts', async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);
    await openProfile(fx, SEED.accounts.yuna.username);
    await expect(text(fx, SEED.posts.yunaFollowers)).toBeVisible();
  });

  test('a pending follower sees 全員 posts but not フォロワーのみ posts', async (fx) => {
    await signIn(fx, SEED.accounts.saburo.phone);
    await openProfile(fx, SEED.accounts.mio.username);
    await expectHiddenAfter(text(fx, SEED.posts.mioPublicTimeLimited), text(fx, SEED.posts.mioFollowers));
  });

  test('a blocked viewer sees the profile but none of its posts', async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);
    await openProfile(fx, SEED.accounts.rin.username);
    await expect(text(fx, SEED.accounts.rin.displayName)).toBeVisible();
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), text(fx, SEED.posts.rinPublic));
  });

  test('a viewer who is not blocked sees the posts of the profile that blocks someone else', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.rin.username);
    await expect(text(fx, SEED.posts.rinPublic)).toBeVisible();
  });
});

describe('posts.md / 時間限定投稿（表示期間）', () => {
  test('a post scheduled to start later is visible only to its author', async (fx) => {
    const cast = await createAccount(fx, 'cast');
    const stamp = Date.now();
    const liveBody = `e2e live ${stamp}`;
    const scheduledBody = `e2e scheduled ${stamp}`;

    await fx.agent.act('open the compose menu, choose 投稿, write {body} as the post text, keep the audience as 全員, and post it', {
      params: { body: unique(liveBody) },
    });
    await openProfile(fx, cast.username);
    await expect(text(fx, liveBody)).toBeVisible();

    // A recording that starts on a per-account profile path misses on every run.
    await fx.app.open('/');
    await fx.agent.act(
      'open the compose menu, choose 投稿, write {body} as the post text, keep the audience as 全員, turn on 表示期間を指定, set 表示開始 to {startsAt}, and post it',
      { params: { body: unique(scheduledBody), startsAt: SCHEDULED_START } },
    );
    await openProfile(fx, cast.username);
    await expect(text(fx, scheduledBody)).toBeVisible();
    await expect(fx.screen.getByText(/予約 .* から/, { visible: true }).first()).toBeVisible();

    await switchUser(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, cast.username);
    await expectHiddenAfter(text(fx, liveBody), text(fx, scheduledBody));
  });
});
