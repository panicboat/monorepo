import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { SEED } from './support/seed.ts';
import { text } from './support/screen.ts';
import { signIn, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const NO_FOLLOWING_MESSAGE = 'フォロー中のアカウントはまだいません。';

describe('follows-and-blocks.md / 申請と承認', () => {
  test("another profile's pending follow requests are not shown", async (fx) => {
    await signIn(fx, SEED.accounts.mio.phone);
    await fx.app.open(`/u/${SEED.accounts.mio.username}/requests`);
    await expect(text(fx, SEED.accounts.saburo.displayName)).toBeVisible();

    await switchUser(fx, SEED.accounts.jiro.phone);
    await fx.app.open(`/u/${SEED.accounts.mio.username}/requests`);
    await expectHiddenAfter(text(fx, NO_FOLLOWING_MESSAGE), text(fx, SEED.accounts.saburo.displayName));
  });
});
