import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { RECORDING_TIMEOUT_MS, changeBlock } from './support/act.ts';
import type { BrowserActFixtures } from './support/act.ts';
import { BLOCKED_NOTICE, FOLLOW_REQUIRED_NOTICE, messageInput, openThread, sendFromProfile } from './support/messages.ts';
import { text } from './support/screen.ts';
import { createAccount, switchToCreated } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

// The notice and the input are alternatives, so the notice settles first and only then the input is checked to be gone.
async function expectCannotSend(fx: BrowserActFixtures, notice: string, body: string): Promise<void> {
  await expect(text(fx, body)).toBeVisible();
  await expectHiddenAfter(text(fx, notice), messageInput(fx));
}

describe('messages.md / 送信条件', () => {
  test('a block shows the blocked notice in place of the message input', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const guest = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createAccount(fx, 'cast');
    const body = `e2e message ${Date.now()}`;
    await sendFromProfile(fx, cast, guest, body);

    await changeBlock(fx, cast, guest, 'ブロック');
    await openThread(fx, guest);
    await expectCannotSend(fx, BLOCKED_NOTICE, body);
  });

  test('a guest without an approved follow sees the follow notice in place of the message input', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const guest = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createAccount(fx, 'cast');
    const body = `e2e message from cast ${Date.now()}`;
    await sendFromProfile(fx, cast, guest, body);

    await switchToCreated(fx, guest);
    await openThread(fx, cast);
    await expectCannotSend(fx, FOLLOW_REQUIRED_NOTICE, body);
  });
});
