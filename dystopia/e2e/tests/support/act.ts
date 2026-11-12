import type { Browser } from '@e2e-dev/web';
import { unique } from 'e2e';
import type { ActOptions, Agent } from 'e2e';
import type { SeedAccount } from './seed.ts';
import type { SessionFixtures } from './session.ts';

export interface ActFixtures extends SessionFixtures {
  agent: Agent;
}

export interface BrowserActFixtures extends ActFixtures {
  browser: Browser;
}

// A recording run waits on the model for every step, so the default test timeout is too short for a flow with several acts.
export const RECORDING_TIMEOUT_MS = 300_000;
export const SIGNED_IN_AS = 'Signed in as {actorName} (@{actorHandle}), ';

// Display names and handles on the end screen miss the recording unless they are params too.
export function actorParams(account: SeedAccount) {
  return { actorName: unique(account.displayName), actorHandle: unique(account.username) };
}

export function targetParams(account: SeedAccount) {
  return { targetName: unique(account.displayName), targetHandle: unique(account.username) };
}

// A recording that starts on a per-account profile path misses on every run, so every act starts at the home route.
export async function actFromHome(fx: ActFixtures, instruction: string, options?: ActOptions): Promise<void> {
  await fx.app.open('/');
  await fx.agent.act(instruction, options);
}

export async function follow(fx: ActFixtures, target: SeedAccount): Promise<void> {
  await actFromHome(
    fx,
    'open 検索, choose the ユーザー tab, search for {targetHandle}, and tap the フォロー or フォローを申請 button on the result row whose handle is @{targetHandle}',
    { params: { targetHandle: unique(target.username) } },
  );
}

export async function changeBlock(
  fx: BrowserActFixtures,
  actor: SeedAccount,
  target: SeedAccount,
  label: 'ブロック' | 'ブロック解除',
): Promise<void> {
  const listed = label === 'ブロック' ? 'is listed' : 'is gone';
  const off = await fx.browser.onDialog('accept');
  try {
    await actFromHome(
      fx,
      `${SIGNED_IN_AS}open 検索, choose the ユーザー tab, search for {targetHandle}, open the profile of {targetName} (@{targetHandle}) from the result row, open the その他の操作 menu, tap ${label}, then open the menu, choose プロフィール, tap the フォロー中 count, open the ブロック中 tab, and check that the row for {targetName} ${listed}`,
      { params: { ...actorParams(actor), ...targetParams(target) } },
    );
  } finally {
    await off();
  }
}
