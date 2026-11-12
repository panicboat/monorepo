import { describe, test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { RECORDING_TIMEOUT_MS, changeBlock } from './support/act.ts';
import { MENTIONED, commentWithMention, notificationRows, openNotifications } from './support/notifications.ts';
import { POST_FOR_EVERYONE, POST_FOR_FOLLOWERS, post } from './support/posts.ts';
import { createAccount, switchToCreated } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

describe('notifications.md / 通知の種類', () => {
  test('a block by the receiver stops notifications from the blocked actor, and a block by the actor does not', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const receiver = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const blocked = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const blocker = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const author = await createAccount(fx, 'cast');
    const stamp = Date.now();
    const authorBody = `e2e notification target ${stamp}`;
    await post(fx, author, POST_FOR_EVERYONE, authorBody);

    await switchToCreated(fx, receiver);
    await changeBlock(fx, receiver, blocked, 'ブロック');

    await switchToCreated(fx, blocker);
    await changeBlock(fx, blocker, receiver, 'ブロック');
    // Commenting on a third party's post leaves the receiver's block as the only rule that can stop the notification.
    await commentWithMention(fx, blocker, author, authorBody, `e2e mention from blocker ${stamp} @${receiver.username}`);

    await switchToCreated(fx, blocked);
    await commentWithMention(fx, blocked, author, authorBody, `e2e mention from blocked ${stamp} @${receiver.username}`);

    await switchToCreated(fx, receiver);
    await openNotifications(fx);
    // The blocked actor fires last, so an aggregated row would show it as the latest actor if the block did not stop it.
    await expectHiddenAfter(notificationRows(fx, blocker, MENTIONED), notificationRows(fx, blocked, MENTIONED));
  });

  test('a mention does not notify a profile that cannot view the post', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const receiver = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const author = await createAccount(fx, 'cast');
    const stamp = Date.now();
    await post(fx, author, POST_FOR_FOLLOWERS, `e2e followers mention ${stamp} @${receiver.username}`);
    await post(fx, author, POST_FOR_EVERYONE, `e2e public mention ${stamp} @${receiver.username}`);

    await switchToCreated(fx, receiver);
    await openNotifications(fx);
    // The target is the post, so the followers-only post would add a second row from the same author.
    await expect(notificationRows(fx, author, MENTIONED).first()).toBeVisible();
    await expect(notificationRows(fx, author, MENTIONED)).toHaveCount(1);
  });
});
