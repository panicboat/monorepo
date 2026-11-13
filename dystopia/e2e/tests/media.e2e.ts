import { describe, test } from '@e2e-dev/web';
import { expect, unique } from 'e2e';
import { RECORDING_TIMEOUT_MS, actFromHome, actorParams, follow } from './support/act.ts';
import { POST_WITH_IMAGE_FOR_FOLLOWERS, loadedMediaImages } from './support/media.ts';
import { openProfile, text } from './support/screen.ts';
import { createAccount, switchToCreated } from './support/session.ts';

describe('media.md / Rules', () => {
  test('a post image loads for the author and an approved follower', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const follower = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createAccount(fx, 'cast');
    const body = `e2e post image ${Date.now()}`;

    await actFromHome(fx, POST_WITH_IMAGE_FOR_FOLLOWERS, { params: { ...actorParams(cast), body: unique(body) } });
    await openProfile(fx, cast.username);
    await expect(text(fx, body)).toBeVisible();
    await expect.poll(() => loadedMediaImages(fx, body)).toBe(1);

    await switchToCreated(fx, follower);
    await follow(fx, cast);
    await openProfile(fx, cast.username);
    await expect(text(fx, body)).toBeVisible();
    await expect.poll(() => loadedMediaImages(fx, body)).toBe(1);
  });
});
