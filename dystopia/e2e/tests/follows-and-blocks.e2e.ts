import { describe, test } from '@e2e-dev/web';
import { expect, unique } from 'e2e';
import type { Locator } from 'e2e';
import { RECORDING_TIMEOUT_MS, SIGNED_IN_AS, actFromHome, actorParams, changeBlock, follow, targetParams } from './support/act.ts';
import type { BrowserActFixtures } from './support/act.ts';
import { SEED } from './support/seed.ts';
import type { SeedAccount } from './support/seed.ts';
import { EMPTY_POSTS_MESSAGE, openProfile, text } from './support/screen.ts';
import { createAccount, switchToCreated } from './support/session.ts';
import { expectHiddenAfter } from './support/visibility.ts';

// Anchoring on a display name would pass before a list loads, so each list waits for its settled empty message.
const EMPTY_FOLLOWING_MESSAGE = 'フォロー中のアカウントはまだいません。';
const EMPTY_REQUESTS_MESSAGE = '申請はありません。';
const EMPTY_BLOCKS_MESSAGE = 'ブロック中のアカウントはありません。';

const POST_FOR_EVERYONE = `${SIGNED_IN_AS}open the compose menu, choose 投稿, write {body} as the post text, keep the audience as 全員, and post it`;
const POST_FOR_FOLLOWERS = `${SIGNED_IN_AS}open the compose menu, choose 投稿, write {body} as the post text, turn on the フォロワーのみ switch, and post it`;

function bystanderParams(account: SeedAccount) {
  return { otherName: unique(account.displayName), otherHandle: unique(account.username) };
}

function handle(fx: BrowserActFixtures, account: SeedAccount): Locator {
  return text(fx, `@${account.username}`);
}

async function post(fx: BrowserActFixtures, author: SeedAccount, instruction: string, body: string): Promise<void> {
  await actFromHome(fx, instruction, { params: { ...actorParams(author), body: unique(body) } });
  await openProfile(fx, author.username);
  await expect(text(fx, body)).toBeVisible();
}

async function createApprovalCast(fx: BrowserActFixtures, body: string): Promise<SeedAccount> {
  const cast = await createAccount(fx, 'cast');
  await actFromHome(
    fx,
    `${SIGNED_IN_AS}open the menu, choose プロフィール, tap プロフィールを編集, turn on フォローを承認制にする, tap 保存, then reopen プロフィールを編集 and check that フォローを承認制にする is on`,
    { params: actorParams(cast) },
  );
  await openProfile(fx, cast.username);
  await fx.screen.getByRole('button', 'プロフィールを編集').click();
  await expect(fx.screen.getByRole('switch', 'フォローを承認制にする')).toBeChecked();
  await post(fx, cast, POST_FOR_FOLLOWERS, body);
  return cast;
}

async function decideRequest(
  fx: BrowserActFixtures,
  decision: '承認' | '拒否',
  owner: SeedAccount,
  requester: SeedAccount,
  bystander?: SeedAccount,
): Promise<void> {
  const decide = `open the menu, choose プロフィール, tap the フォロー中 count, open the 申請 tab, and tap ${decision} on the row for {targetName} (@{targetHandle})`;
  const params = { ...actorParams(owner), ...targetParams(requester) };
  if (bystander === undefined) {
    await actFromHome(fx, `${SIGNED_IN_AS}${decide}`, { params });
    return;
  }
  await actFromHome(fx, `${SIGNED_IN_AS}${decide}, and leave the row for {otherName} (@{otherHandle}) as it is`, {
    params: { ...params, ...bystanderParams(bystander) },
  });
}

async function openRequests(fx: BrowserActFixtures, owner: SeedAccount): Promise<void> {
  await fx.app.open(`/u/${owner.username}/requests`);
}

async function openBlockedList(fx: BrowserActFixtures, owner: SeedAccount): Promise<void> {
  await fx.app.open(`/u/${owner.username}/following`);
  await fx.screen.getByRole('tab', 'ブロック中').click();
}

async function openFollowing(fx: BrowserActFixtures, owner: SeedAccount): Promise<void> {
  await fx.app.open(`/u/${owner.username}/following`);
}

describe('follows-and-blocks.md / フォロー', () => {
  test('following a profile without approval takes effect immediately', async (fx) => {
    const guest = await createAccount(fx, 'guest');
    await openProfile(fx, SEED.accounts.rin.username);
    await expectHiddenAfter(text(fx, SEED.posts.rinPublic), text(fx, SEED.posts.rinFollowers));

    await fx.agent.act('tap the フォロー button on this profile');
    await expect(fx.screen.getByRole('button', 'メッセージ')).toBeVisible();

    await openProfile(fx, SEED.accounts.rin.username);
    await expect(text(fx, SEED.posts.rinFollowers)).toBeVisible();
    await openFollowing(fx, guest);
    await expect(text(fx, SEED.accounts.rin.displayName)).toBeVisible();
  });
});

describe('follows-and-blocks.md / 申請と承認', () => {
  test('a request stays pending until approved, and approving it leaves other requests pending', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const requester = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const other = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const body = `e2e followers only ${Date.now()}`;
    const cast = await createApprovalCast(fx, body);

    await switchToCreated(fx, requester);
    await follow(fx, cast);
    await openProfile(fx, cast.username);
    await expect(fx.screen.getByRole('button', '申請中')).toBeVisible();
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), text(fx, body));

    await switchToCreated(fx, other);
    await follow(fx, cast);
    await openProfile(fx, cast.username);
    await expect(fx.screen.getByRole('button', '申請中')).toBeVisible();

    await switchToCreated(fx, cast);
    await decideRequest(fx, '承認', cast, requester, other);
    await openRequests(fx, cast);
    await expectHiddenAfter(handle(fx, other), handle(fx, requester));

    await switchToCreated(fx, requester);
    await openProfile(fx, cast.username);
    await expect(text(fx, body)).toBeVisible();

    await switchToCreated(fx, other);
    await openProfile(fx, cast.username);
    await expect(fx.screen.getByRole('button', '申請中')).toBeVisible();
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), text(fx, body));
  });

  test('a rejected request hides posts and can be sent again', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const requester = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const body = `e2e followers only ${Date.now()}`;
    const cast = await createApprovalCast(fx, body);

    await switchToCreated(fx, requester);
    await follow(fx, cast);
    await openProfile(fx, cast.username);
    await expect(fx.screen.getByRole('button', '申請中')).toBeVisible();

    await switchToCreated(fx, cast);
    await decideRequest(fx, '拒否', cast, requester);
    await openRequests(fx, cast);
    await expectHiddenAfter(text(fx, EMPTY_REQUESTS_MESSAGE), handle(fx, requester));

    await switchToCreated(fx, requester);
    await openProfile(fx, cast.username);
    await expect(fx.screen.getByRole('button', 'フォローを申請')).toBeVisible();
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), text(fx, body));

    await follow(fx, cast);
    await openProfile(fx, cast.username);
    await expect(fx.screen.getByRole('button', '申請中')).toBeVisible();

    await switchToCreated(fx, cast);
    await decideRequest(fx, '承認', cast, requester);
    await openRequests(fx, cast);
    await expectHiddenAfter(text(fx, EMPTY_REQUESTS_MESSAGE), handle(fx, requester));

    await switchToCreated(fx, requester);
    await openProfile(fx, cast.username);
    await expect(text(fx, body)).toBeVisible();
  });
});

describe('follows-and-blocks.md / ブロック', () => {
  test('blocking hides posts and removes the follow, and unblocking shows posts without restoring the follow', { timeout: RECORDING_TIMEOUT_MS }, async (fx) => {
    const guest = await createAccount(fx, 'guest');
    await fx.app.clearState();
    const cast = await createAccount(fx, 'cast');
    const body = `e2e public ${Date.now()}`;
    await post(fx, cast, POST_FOR_EVERYONE, body);

    await switchToCreated(fx, guest);
    await follow(fx, cast);
    await openFollowing(fx, guest);
    await expect(text(fx, cast.displayName)).toBeVisible();

    await switchToCreated(fx, cast);
    await changeBlock(fx, cast, guest, 'ブロック');
    await openBlockedList(fx, cast);
    await expect(handle(fx, guest)).toBeVisible();
    // A row button reads ブロック until its status loads, so both labels are counted to count the rows.
    await expect(fx.screen.getByRole('button', /^ブロック(解除)?$/)).toHaveCount(1);

    await switchToCreated(fx, guest);
    await openProfile(fx, cast.username);
    await expect(text(fx, cast.displayName)).toBeVisible();
    await expectHiddenAfter(text(fx, EMPTY_POSTS_MESSAGE), text(fx, body));
    await openProfile(fx, SEED.accounts.yuna.username);
    await expect(text(fx, SEED.posts.yunaPublic)).toBeVisible();
    await openFollowing(fx, guest);
    await expectHiddenAfter(text(fx, EMPTY_FOLLOWING_MESSAGE), text(fx, cast.displayName));

    await switchToCreated(fx, cast);
    await changeBlock(fx, cast, guest, 'ブロック解除');
    await openBlockedList(fx, cast);
    await expectHiddenAfter(text(fx, EMPTY_BLOCKS_MESSAGE), handle(fx, guest));

    await switchToCreated(fx, guest);
    await openProfile(fx, cast.username);
    await expect(text(fx, body)).toBeVisible();
    await openFollowing(fx, guest);
    await expectHiddenAfter(text(fx, EMPTY_FOLLOWING_MESSAGE), text(fx, cast.displayName));
  });
});
