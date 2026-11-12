import { expect, unique } from 'e2e';
import { SIGNED_IN_AS, actFromHome, actorParams, targetParams } from './act.ts';
import type { ActFixtures } from './act.ts';
import type { SeedAccount } from './seed.ts';
import { openProfile } from './screen.ts';

function bystanderParams(account: SeedAccount) {
  return { otherName: unique(account.displayName), otherHandle: unique(account.username) };
}

export async function requireApproval(fx: ActFixtures, cast: SeedAccount): Promise<void> {
  await actFromHome(
    fx,
    `${SIGNED_IN_AS}open the menu, choose プロフィール, tap プロフィールを編集, turn on フォローを承認制にする, tap 保存, then reopen プロフィールを編集 and check that フォローを承認制にする is on`,
    { params: actorParams(cast) },
  );
  await openProfile(fx, cast.username);
  await fx.screen.getByRole('button', 'プロフィールを編集').click();
  await expect(fx.screen.getByRole('switch', 'フォローを承認制にする')).toBeChecked();
}

export async function decideRequest(
  fx: ActFixtures,
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
