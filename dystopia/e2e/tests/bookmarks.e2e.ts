import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { SEED } from './support/seed.ts';
import { POST_UNAVAILABLE_MESSAGE, openProfile, text } from './support/screen.ts';
import { createAccount } from './support/session.ts';
import { block } from './support/social.ts';
import { expectHiddenAfter } from './support/visibility.ts';

describe('bookmarks.md / 追加・一覧・状態の判定', () => {
  test('a bookmark of a post whose author the viewer blocked stays listed as unavailable', async (fx) => {
    await createAccount(fx, 'guest');
    const card = fx.screen.getByRole('article').filter({ hasText: SEED.posts.yunaPublic });

    await openProfile(fx, SEED.accounts.yuna.username);
    await card.getByRole('button', 'ブックマーク').click();
    await expect(card.getByRole('button', 'ブックマークを解除')).toBeVisible();
    await fx.app.open('/bookmarks');
    await expect(text(fx, SEED.posts.yunaPublic)).toBeVisible();

    await block(fx, SEED.accounts.yuna);
    await fx.app.open('/bookmarks');
    await expectHiddenAfter(text(fx, POST_UNAVAILABLE_MESSAGE), text(fx, SEED.posts.yunaPublic));
    await expect(fx.screen.getByRole('button', 'ブックマークを外す')).toBeVisible();
  });
});
