import { expect, unique } from 'e2e';
import { SIGNED_IN_AS, actFromHome, actorParams } from './act.ts';
import type { ActFixtures } from './act.ts';
import type { SeedAccount } from './seed.ts';
import { openProfile, text } from './screen.ts';

export const POST_FOR_EVERYONE = `${SIGNED_IN_AS}open the compose menu, choose 投稿, write {body} as the post text, keep the audience as 全員, and post it`;
export const POST_FOR_FOLLOWERS = `${SIGNED_IN_AS}open the compose menu, choose 投稿, write {body} as the post text, turn on the フォロワーのみ switch, and post it`;

export async function post(fx: ActFixtures, author: SeedAccount, instruction: string, body: string): Promise<void> {
  await actFromHome(fx, instruction, { params: { ...actorParams(author), body: unique(body) } });
  await openProfile(fx, author.username);
  await expect(text(fx, body)).toBeVisible();
}
