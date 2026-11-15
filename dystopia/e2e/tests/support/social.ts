import { expect } from 'e2e';
import type { SeedAccount } from './seed.ts';
import { openProfile } from './screen.ts';
import type { BrowserFixtures, SessionFixtures } from './session.ts';

export async function follow(fx: SessionFixtures, target: SeedAccount): Promise<void> {
  await openProfile(fx, target.username);
  const button = fx.screen.getByRole('button', /^フォロー(を申請)?$/);
  await button.click();
  // The button stays on the page while the request fails, so its removal marks the follow as accepted.
  await expect(button).toHaveCount(0);
}

// The menu turns to ブロック解除 only after the server accepts the block, so leaving the page before that could cancel it.
export async function block(fx: BrowserFixtures, target: SeedAccount): Promise<void> {
  await openProfile(fx, target.username);
  // Each post card has its own その他の操作 menu, and the profile's comes before them.
  const menu = fx.screen.getByRole('button', 'その他の操作').first();
  const off = await fx.browser.onDialog('accept');
  try {
    await menu.click();
    await fx.screen.getByRole('menuitem', 'ブロック').click();
  } finally {
    await off();
  }
  await menu.click();
  await expect(fx.screen.getByRole('menuitem', 'ブロック解除')).toBeVisible();
}
