import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { SEED } from './support/seed.ts';
import { handle, text } from './support/screen.ts';
import { signIn } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const JST_OFFSET_HOURS = 9;
const BUSINESS_DAY_START_HOUR = 5;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function businessDate(offsetDays: number): string {
  const shifted = Date.now() + (JST_OFFSET_HOURS - BUSINESS_DAY_START_HOUR) * MS_PER_HOUR + offsetDays * MS_PER_DAY;
  return new Date(shifted).toISOString().slice(0, 10);
}

// Day 3 holds seed schedules of both rin and mio and stays inside the search range at any hour.
const SCHEDULE_DAY = businessDate(3);

// An empty prefecture is 全国; without it the viewer's own prefecture would hide the other casts by area.
const scheduleSearch = () => `/search?${new URLSearchParams({ q: '', tab: 'schedules', prefecture: '', date: SCHEDULE_DAY })}`;
const postSearch = (q: string) => `/search?${new URLSearchParams({ q, tab: 'posts' })}`;
const userSearch = (q: string) => `/search?${new URLSearchParams({ q, tab: 'users' })}`;

describe('search.md / 検索結果に出ない条件', () => {
  test('a blocked profile is missing from post and schedule search but present in user search', async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);

    await fx.app.open(postSearch('/Public/Public]'));
    await expectHiddenAfter(text(fx, SEED.posts.yunaPublic), text(fx, SEED.posts.rinPublic));

    await fx.app.open(scheduleSearch());
    await expectHiddenAfter(text(fx, SEED.accounts.mio.displayName), text(fx, SEED.accounts.rin.displayName));

    await fx.app.open(userSearch(SEED.accounts.rin.username));
    await expect(handle(fx, SEED.accounts.rin)).toBeVisible();
  });

  test('a locked cast is missing from schedule search for a viewer who cannot pass the lock but present in user search', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);

    await fx.app.open(scheduleSearch());
    await expectHiddenAfter(text(fx, SEED.accounts.rin.displayName), text(fx, SEED.accounts.mio.displayName));

    await fx.app.open(userSearch(SEED.accounts.mio.username));
    await expect(handle(fx, SEED.accounts.mio)).toBeVisible();
  });

  test('a followers-only post is missing from post search even for an approved follower', async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);

    await fx.app.open(postSearch('[Yuna/Public/'));
    await expectHiddenAfter(text(fx, SEED.posts.yunaPublic), text(fx, SEED.posts.yunaFollowers));
  });
});
