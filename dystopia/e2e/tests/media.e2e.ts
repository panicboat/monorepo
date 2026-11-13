import { describe, test } from '@e2e-dev/web';
import { expect, unique } from 'e2e';
import { RECORDING_TIMEOUT_MS, actFromHome, actorParams, follow } from './support/act.ts';
import { POST_WITH_IMAGE_FOR_FOLLOWERS, loadedMediaImages } from './support/media.ts';
import { SEED } from './support/seed.ts';
import { EMPTY_POSTS_MESSAGE, openProfile, text } from './support/screen.ts';
import { createAccount, switchToCreated, switchUser } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

describe('media.md / Rules', () => {
  test('a post image loads for viewers who can see the post and stays away from those who cannot', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
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

    await switchUser(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, cast.username);
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), text(fx, body));
  });
});
