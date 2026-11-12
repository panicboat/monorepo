import { expect } from 'e2e';
import type { App, Locator, Screen } from 'e2e';
import { SEED } from './seed.ts';
import type { SeedAccount } from './seed.ts';

export interface SessionFixtures {
  app: App;
  screen: Screen;
}

export type AccountRole = 'cast' | 'guest';

const SEED_PASSWORD = 'password';
export const NEW_ACCOUNT_PASSWORD = 'E2e-Password-1';
const CONFIRMATION_CODE = '000000';
const ROLE_LABELS: Record<AccountRole, string> = { cast: 'キャスト', guest: 'ゲスト' };
const FEATURE_TOUR_WAIT_MS = 2_000;

export async function signIn(fx: SessionFixtures, phone: string, password = SEED_PASSWORD): Promise<void> {
  const { app, screen } = fx;
  await app.open('/login');
  await screen.getByLabel('電話番号').fill(phone);
  await screen.getByLabel('パスワード').fill(password);
  await screen.getByRole('button', 'ログイン').click();

  const picker = screen.getByRole('heading', 'プロフィールを選択');
  await expect(picker.or(featureTour(screen)).or(shellMenu(screen)).first()).toBeVisible();
  if (await picker.isVisible()) {
    const username = primaryUsername(phone);
    await screen.getByRole('button').filter({ hasText: new RegExp(`@${username}$`) }).click();
  }
  await enterHome(screen);
}

export async function switchUser(fx: SessionFixtures, phone: string, password = SEED_PASSWORD): Promise<void> {
  await fx.app.clearState();
  await signIn(fx, phone, password);
}

export async function createAccount(fx: SessionFixtures, role: AccountRole): Promise<SeedAccount> {
  const { app, screen } = fx;
  const account = newAccount();

  await app.open('/signup');
  await screen.getByRole('button', 'はい（18歳以上です）').click();
  await screen.getByLabel('電話番号').fill(account.phone);
  await screen.getByLabel('パスワード').fill(NEW_ACCOUNT_PASSWORD);
  await screen.getByText(ROLE_LABELS[role]).click();
  await screen.getByRole('checkbox').check();
  await screen.getByRole('button', 'SMS を送信').click();

  await screen.getByLabel('認証コード').fill(CONFIRMATION_CODE);
  await screen.getByRole('button', '登録を完了').click();

  await screen.getByLabel(/^表示名/).fill(account.displayName);
  await screen.getByLabel(/^ユーザー名/).fill(account.username);
  await screen.getByRole('button', '完了').click();
  await enterHome(screen);
  return account;
}

function featureTour(screen: Screen): Locator {
  return screen.getByRole('button', 'はじめる');
}

function shellMenu(screen: Screen): Locator {
  return screen.getByRole('button', 'メニューを開く');
}

// The tour opens in the same render as the shell, so a short wait is enough to tell that it was already seen.
async function enterHome(screen: Screen): Promise<void> {
  const tour = featureTour(screen);
  await expect(tour.or(shellMenu(screen)).first()).toBeVisible();
  if (await appearsWithin(tour, FEATURE_TOUR_WAIT_MS)) {
    await tour.click();
    await expect(tour).toHaveCount(0);
  }
  await expect(shellMenu(screen)).toBeVisible();
}

async function appearsWithin(locator: Locator, timeout: number): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    // SILENT: a locator that does not appear within the wait is the answer, not a failure.
    return false;
  }
}

function primaryUsername(phone: string): string {
  const account = Object.values(SEED.accounts).find((seed) => seed.phone === phone);
  if (account === undefined) {
    throw new Error(`${phone} has several profiles but is not a seed account`);
  }
  return account.username;
}

function newAccount(): SeedAccount {
  // Eight digits from 10000000 never collide with the seed numbers, whose digits after +8190 start with 0000.
  const phoneDigits = String(10_000_000 + Math.floor(Math.random() * 90_000_000));
  const suffix = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0');
  const username = `e2e_${Date.now().toString(36)}${suffix}`;
  return { phone: `+8190${phoneDigits}`, username, displayName: `E2E ${username.slice(-6)}` };
}
