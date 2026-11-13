import { describe, test } from '@e2e-dev/web';
import { SEED } from './support/seed.ts';
import { PROFILE_NOT_FOUND_MESSAGE, openProfile, text } from './support/screen.ts';
import { openReviewsTab, reviewCards } from './support/reviews.ts';
import { signIn } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

const LOCKED_MESSAGE = 'フォローすると見られます';

describe('profiles.md / 鍵とフォローの承認制', () => {
  test('a non-follower sees the follow notice in place of the reviews on a locked profile', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openReviewsTab(fx, SEED.accounts.mio.username);
    await expectHiddenAfter(text(fx, LOCKED_MESSAGE), reviewCards(fx));
  });
});

describe('profiles.md / 他人から見えるか', () => {
  test('a profile whose account is withdrawn is not shown to others', async (fx) => {
    await signIn(fx, SEED.accounts.jiro.phone);
    await openProfile(fx, SEED.accounts.goro.username);
    await expectHiddenAfter(text(fx, PROFILE_NOT_FOUND_MESSAGE), text(fx, SEED.accounts.goro.displayName));
  });
});
