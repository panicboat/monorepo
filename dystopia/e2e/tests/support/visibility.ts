import { expect } from 'e2e';
import type { Locator } from 'e2e';

export async function expectHiddenAfter(present: Locator, absent: Locator): Promise<void> {
  await expect(present).toBeVisible();
  await expect(absent).toHaveCount(0);
}
