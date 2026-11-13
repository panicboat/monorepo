import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { RECORDING_TIMEOUT_MS, changeBlock } from './support/act.ts';
import { SEED } from './support/seed.ts';
import { POST_UNAVAILABLE_MESSAGE, openProfile, text } from './support/screen.ts';
import { createAccount } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

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
