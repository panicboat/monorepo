# Services — Local Development Guide

`services/monolith` (Ruby / Hanami / gRPC) と `services/frontend` (Next.js / BFF) を
1 台の macOS で立ち上げて end-to-end で触るための手順。CI / production では別のパス
(container image + k8s / gateway) が使われるため、この文書は **ローカル開発と
実機 dogfooding 専用** の設定を扱う。

## Overview

```
Browser  ──http──▶  Next.js frontend :3000  ──gRPC──▶  Ruby monolith :9001  ──▶  Postgres :5432
                    (BFF / cookie mediation)             (Gruf server / 15 services)
```

Frontend は httpOnly cookie に session を保持し、gRPC 呼び出しは BFF が代理する
(post-#763 の cookie mediation)。Local では http://localhost でこれを回すため、
Secure cookie 制約の回避に一手間が要る (`INSECURE_COOKIES` を参照)。

## Prerequisites

- macOS + Homebrew
- PostgreSQL 18 (`brew install postgresql@18`)
- Ruby 3.4.5 (rbenv 経由。`services/monolith/workspace/.ruby-version` に定義)
- Node.js + pnpm 10.x
- OpenSSL (macOS 標準 or `brew install openssl`)

## Database — PostgreSQL

Homebrew 版の常駐 daemon をそのまま使う。docker-compose の `db` は :5432 と
衝突するので起動しない。

```bash
# 常駐開始 (ログイン時に自動起動される)
brew services start postgresql@18

# 起動確認
/opt/homebrew/opt/postgresql@18/bin/pg_isready -h localhost -p 5432

# 停止
brew services stop postgresql@18
```

接続情報:

- URL: `postgres://postgres:password@localhost:5432/monolith`
- `psql` は `/opt/homebrew/opt/postgresql@18/bin/psql` を絶対 path で使う
  (`postgresql@14` が別途 install されているマシンでは v14 が先に PATH に
  乗っており、pg_dump の version mismatch を招く)

初回セットアップ (schema 作成):

```bash
cd services/monolith/workspace
bundle exec hanami db migrate
```

`bundle exec hanami db seed` は現在 `Portfolio::Areas` を含む一部の旧 seed
ファイルで失敗するので使わない。テストアカウントは
[Seeding test users](#seeding-test-users) の手順で INSERT する。

## Monolith — Ruby gRPC :9001

`services/monolith/workspace` は Hanami slice 構成の gRPC server。Gruf で
15 の Service (Identity / Profile / Karte / Social / Post / Feed /
Discovery / Messaging / Footprints / Notifications / Bookmarks /
Media / Karte) を bind する。

### JWT keys

`lib/auth/jwt_codec.rb` が起動時に **`JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`
を必須** で `ENV.fetch` する (RS256 / lazy 評価なので boot は通るが、
最初の認証 RPC で落ちる)。docker-compose には鍵が入っていないので毎回
自前生成する。1 プロセス内で sign と verify を同じ鍵で行うので自己生成で
整合する。

```bash
mkdir -p /tmp
openssl genrsa 2048 > /tmp/dogfood-jwt-priv.pem
openssl rsa -in /tmp/dogfood-jwt-priv.pem -pubout > /tmp/dogfood-jwt-pub.pem
```

`/tmp/` に置くと reboot で消えるが、ローカル開発では毎回作り直しでよい。

### SMS adapter

Signup / login の SMS code 送信は `SMS_ADAPTER=fake` で fake adapter に切り替える。
実 SMS provider を呼ばず、`identity.sms_verifications` に code を直接書き込む。
最新 code は SQL で取り出す:

```sql
SELECT code FROM identity.sms_verifications
WHERE phone_number = '+819011111111'
ORDER BY created_at DESC LIMIT 1;
```

新しい `send-sms` 呼び出しごとに code が更新される (single-use なので古い code は
verify で reject される)。

### Startup

```bash
cd services/monolith/workspace
bundle install    # Renovate 経由で gem が更新されるので新しい main では毎回

export DATABASE_URL=postgres://postgres:password@localhost:5432/monolith
export JWT_PRIVATE_KEY="$(cat /tmp/dogfood-jwt-priv.pem)"
export JWT_PUBLIC_KEY="$(cat /tmp/dogfood-jwt-pub.pem)"
export SMS_ADAPTER=fake

bundle exec ruby bin/grpc
```

起動 log の末尾で `Services: [Identity::V1::IdentityService::Service, ..., Karte::V1::KarteService::Service]` の
15 個の service 一覧と `[gruf] Starting gruf server at 0.0.0.0:9001...` が出れば ready。

### Port conflict

`:9001` に古い ruby プロセスが listen したまま残ることがある (bg で起動して
tab を閉じたケースなど)。SO_REUSEPORT で複数プロセスが同じ port に bind でき、
古い方が先に accept して古いコードのまま応答する。**新しい monolith を起動する前に**
必ず片付ける:

```bash
lsof -iTCP:9001 -sTCP:LISTEN -P
kill -9 <PID>
```

## Frontend — Next.js :3000

`services/frontend/workspace` は Next.js 16 (Turbopack) + App Router。
`MONOLITH_URL` は既定で `localhost:9001` を見る。

### Dev mode (`pnpm dev`)

短時間の UI 確認向き。Turbopack の HMR が効くので tsx を書きながら
即座に反映される。

```bash
cd services/frontend/workspace
pnpm install --prefer-offline
pnpm dev
```

**制約**: dev mode の HTTP/2 1-connection 制限 + `/api/messaging/stream` の SSE 
long-poll が組み合わさると、stream を抱えた状態で新規 request (sign-in など) が
15-20 秒待たされる。dogfood で複数回 sign-in を回すなら:

- (a) `/messages` を flow の最後に置く (SSE を最後まで open しない)
- (b) round ごとに `pkill -9 -f "next dev"` で stream を切る
- (c) production mode に切り替える (下記)

### Production mode (`pnpm build && pnpm start`)

Puppet / 実機 dogfood で長時間触るならこちら。SSE long-poll が dev mode のように
connection pool を圧迫しない。

```bash
cd services/frontend/workspace
pnpm build
INSECURE_COOKIES=true pnpm start
```

`INSECURE_COOKIES` については次節参照。

**Note**: `next start` は `output: standalone` の warning を出すが、実挙動は
問題ない (`.next/standalone/server.js` が canonical だが `next start` でも動く)。

### INSECURE_COOKIES escape ⚠️

Production build (`NODE_ENV=production`) の `setAuthCookies` は Secure 属性付き
cookie を発行する。Chrome は Secure cookie を `http://localhost` に保存
**しない** ため (Secure 属性は scheme で判定される。Chrome の localhost 例外は
secure context の話であって scheme の話ではない)、そのままだと sign-in は 200
を返すが以降の request が unauthenticated になる。

`services/frontend/workspace/src/lib/auth/cookies.ts` にこの escape が
入っている:

```ts
const insecureCookies = process.env.INSECURE_COOKIES === "true";
const cookieSecure = isProd && !insecureCookies;
```

**production deploy では絶対に `INSECURE_COOKIES` を set しない。** k8s
Deployment の env / CI/CD pipeline / infra 定義に `INSECURE_COOKIES` が現れて
いたら誤設定と扱う。

Fail-loud として、起動時に env var が set されていると console.warn が出る:

```
[cookies] INSECURE_COOKIES=true detected with NODE_ENV=production.
Cookies will NOT have the Secure flag. This must ONLY happen on a
local HTTP-only host — deployed instances must keep this env var unset.
```

このメッセージがデプロイ環境の log に出ていたら、runbook として
env を unset する対処を優先する。

## Seeding test users

`hanami db seed` を使わず、`psql` で直接 INSERT する。password は bcrypt で
事前計算する:

```bash
# BCrypt hash を計算 (rails/hanami console でなくても ruby だけで OK)
env -u NODE_OPTIONS bundle exec ruby -e '
  require "bcrypt"
  puts BCrypt::Password.create("00000000", cost: 12).to_s
'
```

出力 hash と `SecureRandom.uuid_v7` の id を差し込む:

```sql
-- cast (role=2) と guest (role=1)
INSERT INTO identity.users (id, phone_number, password_digest, role)
VALUES
  ('<uuid1>', '+819011111111', '<bcrypt_hash>', 2),
  ('<uuid2>', '+818011111111', '<bcrypt_hash>', 1);

-- Karte access は cast にのみ手動付与 (paywall 境界のスタブ)
INSERT INTO karte.access (account_id, granted_at, granted_by)
VALUES ('<uuid1>', now(), 'seed');

-- Profile は onboarding UI 経由で作れるが、seed で埋めておくと login 直後に触れる
INSERT INTO profile.profiles
  (account_id, username, display_name, sns_links, prefecture, is_private,
   age, height_cm, cup_size, industry)
VALUES
  ('<uuid1>', 'cast_dogfood', 'キャスト太郎',
   '{}'::jsonb, '東京都', false, 0, 0, '', ''),
  ('<uuid2>', 'guest_dogfood', 'ゲスト次郎',
   '{}'::jsonb, '東京都', false, 0, 0, '', '');
```

制約:

- phone は E.164 (`+81` 付き) 形式で保存する必要がある。UI は日本国内フォーマット
  (`09011111111`) を受け付けるが、DB では `+81` 込みで持つ
- password は最短 8 文字 (`Auth::MIN_PASSWORD_LENGTH`)。過去の seed で使われて
  いた 4 桁 password (`"0000"` 等) は login contract で reject される
- `role`: 1 = guest / 2 = cast (`identity.v1.Role` enum に対応)

## Verification

両プロセス起動後:

```bash
# monolith が listen しているか
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9001/  # gRPC なので HTTP は 400 系だが接続は成立

# frontend
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/

# BFF 経由で sign-in
curl -s -X POST http://localhost:3000/api/identity/sign-in \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+819011111111","password":"00000000"}'
```

sign-in が 200 で `{"account": {...}, "reactivated": false}` を返せば
end-to-end で疎通している。UI で確認するときは http://localhost:3000/login に
同じ credential を入れる。

## Monitoring during dogfood

UI が 200 を返しても monolith 側で ERROR が出ているケースがあるので (このパターンで
2026-06 に discovery / karte / social で bug を 3 件発見済み)、両方を並行 tail する:

```bash
# monolith を起動したシェルとは別に
tail -f /tmp/dogfood-monolith.log | jq -r 'select(.severity == "ERROR")'

# frontend
tail -f /tmp/dogfood-frontend.log
```

## Common issues

**`Bundler::GemNotFound`**: Renovate 経由で gem 更新されている。`bundle install`
してから再起動。

**`ExperimentalWarning: localStorage is not available`**: buf の TypeScript
codegen で出る Node の warning。無害。

**puppeteer が `Runtime.callFunctionOn timed out`**: `window.confirm` を
使う UI (BlockButton など) で page.evaluate が dialog に blocked。
`page.on("dialog", d => d.accept())` を attach する。

**`next start` の `output: standalone` 警告**: 動作には影響なし。canonical には
`node .next/standalone/server.js` だが、`next start` でも同じ port で起動する。

## Cleanup

```bash
# 自分が起動した process のみ kill (ホストの postgres は触らない)
pkill -f "ruby bin/grpc"
pkill -9 -f "next start\|next dev\|next-server"

# 確認
lsof -iTCP:9001,3000 -sTCP:LISTEN -P
```

DB の seed 痕跡を消したいときは:

```sql
DELETE FROM identity.users WHERE phone_number LIKE '+81%';
-- 各 slice の関連行は per-slice の cascade / PurgeAccount 経由で片付ける
-- (詳細は docs/superpowers/specs/2026-06-29-account-durability-design.md)
```
