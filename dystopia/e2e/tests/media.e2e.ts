import { describe, test } from '@e2e-dev/web';
import { expect, unique } from 'e2e';
import { RECORDING_TIMEOUT_MS, actFromHome, actorParams, follow } from './support/act.ts';
import { POST_WITH_IMAGE_FOR_FOLLOWERS, loadedMediaImages } from './support/media.ts';
import { openProfile, text } from './support/screen.ts';
import { createAccount, switchToCreated } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const EMPTY_MEDIA_MESSAGE = 'メディア付きの投稿はありません';

describe('media.md / Rules', () => {
  test('a followers-only post image loads for the author and an approved follower but not before the follow', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const follower = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createAccount(fx, 'cast');
    const body = `e2e post image ${Date.now()}`;

    await actFromHome(fx, POST_WITH_IMAGE_FOR_FOLLOWERS, { params: { ...actorParams(cast), body: unique(body) } });
    await openProfile(fx, cast.username);
    await expect(text(fx, body)).toBeVisible();
    await expect.poll(() => loadedMediaImages(fx, body)).toBe(1);

    await switchToCreated(fx, follower);
    await fx.app.open(`/u/${cast.username}?tab=media`);
    await expectHiddenAfter(text(fx, EMPTY_MEDIA_MESSAGE), text(fx, body));

    await follow(fx, cast);
    await openProfile(fx, cast.username);
    await expect(text(fx, body)).toBeVisible();
    await expect.poll(() => loadedMediaImages(fx, body)).toBe(1);
  });
});
