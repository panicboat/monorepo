export interface SeedAccount {
  phone: string;
  username: string;
  displayName: string;
}

export const SEED = {
  accounts: {
    yuna: { phone: '+819000000101', username: 'yuna', displayName: 'ゆな' },
    mio: { phone: '+819000000102', username: 'mio', displayName: 'みお' },
    rin: { phone: '+819000000103', username: 'rin', displayName: 'りん' },
    taro: { phone: '+819000000104', username: 'taro', displayName: 'たろう' },
    jiro: { phone: '+819000000105', username: 'jiro', displayName: 'じろう' },
    saburo: { phone: '+819000000106', username: 'saburo', displayName: 'さぶろう' },
    shiro: { phone: '+819000000107', username: 'shiro', displayName: 'しろう' },
    goro: { phone: '+819000000108', username: 'goro', displayName: 'ごろう' },
  },
  posts: {
    yunaPublic: '[Yuna/Public/Public] 新しいドレスを買いました',
    yunaFollowers: '[Yuna/Public/Private] フォロワー限定！来週のイベント情報',
    mioPublicTimeLimited: '[Mio/Private/Public] 今夜23時まで空いています',
    mioFollowers: '[Mio/Private/Private] メンバー限定の特別なお知らせ',
    rinPublic: '[Rin/Public/Public] カフェでまったり',
    rinFollowers: '[Rin/Public/Private] フォロワーさん限定のオフショット',
  },
  // The profile schedule tab spaces the times around U+301C, but the search result card does not, so these only match the tab.
  schedules: {
    mio: '20:00 〜 04:00',
    rin: '15:00 〜 23:00',
  },
} as const satisfies { accounts: Record<string, SeedAccount>; posts: Record<string, string>; schedules: Record<string, string> };
