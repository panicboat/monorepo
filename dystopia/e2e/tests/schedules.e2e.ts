import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { SEED } from './support/seed.ts';
import { openProfile, text } from './support/screen.ts';
import { signIn, switchUser } from './support/session.ts';
import type { SessionFixtures } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const LOCKED_NOTICE = 'フォローすると見られます';
const NO_SCHEDULES = '予定はありません';

async function openScheduleTab(fx: SessionFixtures, username: string): Promise<void> {
  await fx.app.open(`/u/${username}?tab=schedule`);
}

async function openComposeMenu(fx: SessionFixtures): Promise<void> {
  await fx.screen.getByRole('button', '作成メニュー').click();
}

describe('schedules.md / 予定の見え方', () => {
  test('a locked cast shows its schedules to an approved follower', async (fx) => {
    await signIn(fx, SEED.accounts.taro.phone);
    await openScheduleTab(fx, SEED.accounts.mio.username);
    await expect(text(fx, SEED.schedules.mio)).toBeVisible();
  });

  test('a locked cast tells a viewer without a follow and a pending follower to follow instead of listing schedules', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openScheduleTab(fx, SEED.accounts.mio.username);
    await expectHiddenAfter(text(fx, LOCKED_NOTICE), text(fx, SEED.schedules.mio));

    await switchUser(fx, SEED.accounts.saburo.phone);
    await openScheduleTab(fx, SEED.accounts.mio.username);
    await expectHiddenAfter(text(fx, LOCKED_NOTICE), text(fx, SEED.schedules.mio));
  });

  test('a block leaves the schedule tab empty without the follow notice', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openScheduleTab(fx, SEED.accounts.rin.username);
    await expect(text(fx, SEED.schedules.rin)).toBeVisible();

    await switchUser(fx, SEED.accounts.taro.phone);
    await openScheduleTab(fx, SEED.accounts.rin.username);
    await expect(text(fx, NO_SCHEDULES)).toBeVisible();
    await expect(text(fx, SEED.schedules.rin)).toHaveCount(0);
    await expect(text(fx, LOCKED_NOTICE)).toHaveCount(0);
  });
});

describe('schedules.md / 登録できるユーザー', () => {
  test('a guest has no schedule tab and no 予定 in the compose menu or the bottom menu', async (fx) => {
    await signIn(fx, SEED.accounts.yuna.phone);
    await openProfile(fx, SEED.accounts.yuna.username);
    await expect(fx.screen.getByRole('tab', '予定')).toBeVisible();
    await expect(fx.screen.getByRole('button', '予定')).toBeVisible();
    await openComposeMenu(fx);
    await expect(fx.screen.getByRole('menuitem', '予定')).toBeVisible();

    await switchUser(fx, SEED.accounts.taro.phone);
    await openProfile(fx, SEED.accounts.taro.username);
    await expectHiddenAfter(fx.screen.getByRole('tab', '投稿'), fx.screen.getByRole('tab', '予定'));
    await expectHiddenAfter(fx.screen.getByRole('link', 'クチコミ'), fx.screen.getByRole('button', '予定'));
    await openComposeMenu(fx);
    await expectHiddenAfter(fx.screen.getByRole('menuitem', '投稿'), fx.screen.getByRole('menuitem', '予定'));
  });
});
