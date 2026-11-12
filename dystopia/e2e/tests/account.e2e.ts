import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { SEED } from './support/seed.ts';
import { createAccount, signIn } from './support/session.ts';

describe('account.md / ログイン', () => {
  test('a seeded cast signs in and reaches the home feed', async (fx) => {
    await signIn(fx, SEED.accounts.yuna.phone);
    await expect(fx.browser).toHaveURL('/');
    await fx.app.open(`/u/${SEED.accounts.yuna.username}`);
    await expect(fx.screen.getByText(SEED.posts.yunaPublic, { exact: false, visible: true }).first()).toBeVisible();
  });

  test('a wrong password is rejected with the sign-in error message', async ({ app, screen }) => {
    await app.open('/login');
    await screen.getByLabel('電話番号').fill(SEED.accounts.yuna.phone);
    await screen.getByLabel('パスワード').fill('wrong-password');
    await screen.getByRole('button', 'ログイン').click();
    await expect(screen.getByText('電話番号または認証コードが正しくありません')).toBeVisible();
  });
});

describe('account.md / 登録', () => {
  test('a new guest signs up with the confirmation code and completes onboarding', async (fx) => {
    const account = await createAccount(fx, 'guest');
    await fx.app.open(`/u/${account.username}`);
    await expect(fx.screen.getByText(account.displayName, { visible: true }).first()).toBeVisible();
  });
});
