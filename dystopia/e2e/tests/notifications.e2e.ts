import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { RECORDING_TIMEOUT_MS, follow } from './support/act.ts';
import { text } from './support/screen.ts';
import { createAccount, switchToCreated } from './support/session.ts';

describe('notifications.md / 通知の種類', () => {
  test('a follow reaches the followed profile as a notification', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const guest = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createAccount(fx, 'cast');

    await switchToCreated(fx, guest);
    await follow(fx, cast);
    await expect(fx.screen.getByRole('button', 'フォロー中')).toBeVisible();

    await switchToCreated(fx, cast);
    await fx.app.open('/notifications');
    await expect(text(fx, guest.displayName)).toBeVisible();
  });
});
