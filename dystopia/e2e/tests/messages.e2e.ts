import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { RECORDING_TIMEOUT_MS, changeBlock, follow } from './support/act.ts';
import type { BrowserActFixtures } from './support/act.ts';
import { BLOCKED_NOTICE, FOLLOW_REQUIRED_NOTICE, messageInput, openThread, replyInThread, sendFromProfile } from './support/messages.ts';
import { handle, openProfile, text } from './support/screen.ts';
import { createAccount, switchToCreated } from './support/session.ts';
import { EMPTY_REQUESTS_MESSAGE, decideRequest, openRequests, requireApproval } from './support/social.ts';
import { expectHiddenAfter } from './support/visibility.ts';

// The notice and the input are alternatives, so the notice settles first and only then the input is checked to be gone.
async function expectCannotSend(fx: BrowserActFixtures, notice: string, body: string): Promise<void> {
  await expect(text(fx, body)).toBeVisible();
  await expectHiddenAfter(text(fx, notice), messageInput(fx));
}

describe('messages.md / 送信条件', () => {
  test('a block in either direction stops sending, and the existing messages stay readable', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const guest = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createAccount(fx, 'cast');
    const body = `e2e message ${Date.now()}`;
    await sendFromProfile(fx, cast, guest, body);

    await changeBlock(fx, cast, guest, 'ブロック');
    await openThread(fx, guest);
    await expectCannotSend(fx, BLOCKED_NOTICE, body);

    await switchToCreated(fx, guest);
    await openThread(fx, cast);
    await expectCannotSend(fx, BLOCKED_NOTICE, body);
  });

  test('a guest can send only after the follow is approved, and a cast can send without a follow', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const guest = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createAccount(fx, 'cast');
    await requireApproval(fx, cast);
    const stamp = Date.now();
    const castBody = `e2e message from cast ${stamp}`;
    const guestBody = `e2e message from guest ${stamp}`;
    await sendFromProfile(fx, cast, guest, castBody);

    await switchToCreated(fx, guest);
    await openThread(fx, cast);
    await expectCannotSend(fx, FOLLOW_REQUIRED_NOTICE, castBody);

    await follow(fx, cast);
    await openProfile(fx, cast.username);
    await expect(fx.screen.getByRole('button', '申請中')).toBeVisible();
    await openThread(fx, cast);
    await expectCannotSend(fx, FOLLOW_REQUIRED_NOTICE, castBody);

    await switchToCreated(fx, cast);
    await decideRequest(fx, '承認', cast, guest);
    await openRequests(fx, cast);
    await expectHiddenAfter(text(fx, EMPTY_REQUESTS_MESSAGE), handle(fx, guest));

    await switchToCreated(fx, guest);
    await openThread(fx, cast);
    await expect(text(fx, castBody)).toBeVisible();
    await expect(messageInput(fx)).toBeVisible();
    await expect(text(fx, FOLLOW_REQUIRED_NOTICE)).toHaveCount(0);
    await replyInThread(fx, guest, cast, guestBody, castBody);

    await switchToCreated(fx, cast);
    await openThread(fx, guest);
    await expect(text(fx, guestBody)).toBeVisible();
  });
});
