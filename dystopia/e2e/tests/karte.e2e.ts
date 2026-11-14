import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import type { Locator } from 'e2e';
import type { ActFixtures } from './support/act.ts';
import { SEED } from './support/seed.ts';
import { EMPTY_POSTS_MESSAGE, openProfile, text } from './support/screen.ts';
import { signIn, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

function karteCards(fx: ActFixtures): Locator {
  return fx.screen.getByRole('article');
}

describe('karte.md / Rules', () => {
  test('a guest sees neither the karte tab nor karte contents', async (fx) => {
    await signIn(fx, SEED.accounts.yuna.phone);
    await fx.app.open(`/u/${SEED.accounts.shiro.username}?tab=karte`);
    await expect(karteCards(fx).filter({ hasText: SEED.accounts.rin.displayName })).toBeVisible();

    await switchUser(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.shiro.username);

    await expectHiddenAfter(fx.screen.getByRole('tab', 'クチコミ'), fx.screen.getByRole('tab', 'カルテ'));

    // A broken gate would select the karte tab from the query, so the settled posts pane shows the gate held.
    await fx.app.open(`/u/${SEED.accounts.shiro.username}?tab=karte`);
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), karteCards(fx).filter({ hasText: SEED.accounts.rin.displayName }));
    await expect(fx.screen.getByRole('button', 'このゲストのカルテを書く')).toHaveCount(0);
  });
});
