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
    yunaOsaka: { phone: '+819000000101', username: 'yuna_osaka', displayName: 'ゆな（大阪）' },
    mioKyoto: { phone: '+819000000102', username: 'mio_kyoto', displayName: 'みお（京都）' },
  },
  profileIds: {
    yuna: 'a1111111-1111-4111-8111-111111111111',
    jiro: 'a5555555-5555-4555-8555-555555555555',
  },
  posts: {
    yunaPublic: '[Yuna/Public/Public] 新しいドレスを買いました',
    yunaPrivate: '[Yuna/Public/Private]',
    yunaScheduled: '[Yuna/Public/Public/Scheduled]',
    yunaExpired: '[Yuna/Public/Public/Expired]',
    mioPublic: '[Mio/Private/Public]',
    mioPrivate: '[Mio/Private/Private]',
    rinQuote: '@yuna ちゃんの新衣装かわいい！私も今度見に行こうかな👗',
  },
  schedules: {
    mio: '20:00 〜 04:00',
    rin: '15:00 〜 23:00',
  },
  messages: {
    taroToYuna: '土曜の20時でお願いします',
  },
} as const satisfies {
  accounts: Record<string, SeedAccount>;
  profileIds: Record<string, string>;
  posts: Record<string, string>;
  schedules: Record<string, string>;
  messages: Record<string, string>;
};
