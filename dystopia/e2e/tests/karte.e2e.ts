import { describe, test } from '@e2e-dev/web';
import { expect, unique } from 'e2e';
import type { Locator } from 'e2e';
import { RECORDING_TIMEOUT_MS, SIGNED_IN_AS, actFromHome, actorParams, targetParams } from './support/act.ts';
import type { ActFixtures } from './support/act.ts';
import { SEED } from './support/seed.ts';
import type { SeedAccount } from './support/seed.ts';
import { EMPTY_POSTS_MESSAGE, openProfile, text } from './support/screen.ts';
import { createAccount, signIn, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

// The card shows only the latest event, so this earlier event's note appears only in the detail sheet.
const SEED_KARTE_NOTE = '到着が30分遅れた';

const WRITE_KARTE = `${SIGNED_IN_AS}open 検索, choose the ユーザー tab, search for {targetHandle}, open the profile of {targetName} (@{targetHandle}) from the result row, open the カルテ tab, tap このゲストのカルテを書く, tap the 接客 chip under 記録する段階 (not 接客後), write {note} into the 補足（任意） field, tap カルテを作成, and check that {note} is listed on the カルテ tab`;

function karteCards(fx: ActFixtures): Locator {
  return fx.screen.getByRole('article');
}

async function openKarteTab(fx: ActFixtures, username: string): Promise<void> {
  await openProfile(fx, username);
  await fx.screen.getByRole('tab', 'カルテ').click();
}

async function writeKarte(fx: ActFixtures, author: SeedAccount, guest: SeedAccount, note: string): Promise<void> {
  await actFromHome(fx, WRITE_KARTE, { params: { ...actorParams(author), ...targetParams(guest), note: unique(note) } });
  await expect(text(fx, note)).toBeVisible();
}

describe('karte.md / Rules', () => {
  test('any cast sees kartes written by other casts', async (fx) => {
    await signIn(fx, SEED.accounts.yuna.phone);
    await openKarteTab(fx, SEED.accounts.shiro.username);

    const karte = karteCards(fx).filter({ hasText: SEED.accounts.rin.displayName });
    await expect(karte).toBeVisible();
    await karte.getByRole('button', new RegExp(`@${SEED.accounts.shiro.username}`)).click();
    await expect(text(fx, SEED_KARTE_NOTE)).toBeVisible();
  });

  test('a guest sees neither the karte tab nor karte contents', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.shiro.username);

    await expectHiddenAfter(fx.screen.getByRole('tab', 'クチコミ'), fx.screen.getByRole('tab', 'カルテ'));

    // A broken gate would select the karte tab from the query, so the settled posts pane shows the gate held.
    await fx.app.open(`/u/${SEED.accounts.shiro.username}?tab=karte`);
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), karteCards(fx).filter({ hasText: SEED.accounts.rin.displayName }));
    await expect(fx.screen.getByRole('button', 'このゲストのカルテを書く')).toHaveCount(0);
  });

  test('a karte a cast writes is visible to other casts', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const guest = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const author = await createAccount(fx, 'cast');
    const note = `e2e karte note ${Date.now()}`;

    await writeKarte(fx, author, guest, note);

    await switchUser(fx, SEED.accounts.yuna.phone);
    await openKarteTab(fx, guest.username);
    const karte = karteCards(fx).filter({ hasText: note });
    await expect(karte.filter({ hasText: author.displayName })).toBeVisible();
  });
});
