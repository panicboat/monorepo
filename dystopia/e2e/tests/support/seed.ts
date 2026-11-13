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
    shiro: { phone: '+819000000107', username: 'shiro', displayName: 'しろう' },
    goro: { phone: '+819000000108', username: 'goro', displayName: 'ごろう' },
  },
  posts: {
    yunaPublic: '[Yuna/Public/Public] 新しいドレスを買いました',
  },
  schedules: {
    mio: '20:00 〜 04:00',
  },
} as const satisfies { accounts: Record<string, SeedAccount>; posts: Record<string, string>; schedules: Record<string, string> };
