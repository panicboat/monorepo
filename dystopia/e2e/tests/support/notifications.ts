import { expect, unique } from 'e2e';
import type { Locator } from 'e2e';
import { SIGNED_IN_AS, actFromHome, actorParams, targetParams } from './act.ts';
import type { ActFixtures } from './act.ts';
import type { SeedAccount } from './seed.ts';
import { text } from './screen.ts';
import type { SessionFixtures } from './session.ts';

export const MENTIONED = 'あなたをメンションしました';

const COMMENT_WITH_MENTION = `${SIGNED_IN_AS}open 検索, choose the ユーザー tab, search for {targetHandle}, open the profile of {targetName} (@{targetHandle}) from the result row, open the post {postBody}, write {body} into コメント内容, send it, and check that {body} is listed`;

// A row shows no post excerpt, so it is told apart by the latest actor and the action text; an aggregated row prefixes the action with ほか N 人も.
export function notificationRows(fx: SessionFixtures, actor: SeedAccount, action: string): Locator {
  return fx.screen.getByRole('article').filter({ hasText: actor.displayName }).filter({ hasText: action });
}

// The count reads 0 before the list loads, so callers wait for a row before counting rows.
export async function openNotifications(fx: SessionFixtures): Promise<void> {
  await fx.app.open('/notifications');
  await expect(fx.screen.getByText(/^未読 \d+ 件$/)).toBeVisible();
}

export async function commentWithMention(
  fx: ActFixtures,
  commenter: SeedAccount,
  postAuthor: SeedAccount,
  postBody: string,
  body: string,
): Promise<void> {
  await actFromHome(fx, COMMENT_WITH_MENTION, {
    params: { ...actorParams(commenter), ...targetParams(postAuthor), postBody: unique(postBody), body: unique(body) },
  });
  await expect(text(fx, body)).toBeVisible();
}
