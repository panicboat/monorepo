# Dystopia web push design

## Context

#1495 は、アプリを開いていなくても端末に通知が届くことを求めている。今の通知はアプリ内の一覧（`/notifications`）とバッジだけで、service worker・購読・VAPID 鍵・送信処理のいずれも無い。

今の構成で前提になる事実は次のとおり。

- PWA の manifest はある（`frontend/src/app/manifest.ts`、#1286 は完了）。iOS は、ホーム画面に追加した PWA でだけ Web Push を受け取れる
- アプリ内通知は全て `Notifications::UseCases::Emit` を通って作られる。種類はいいね・コメント・リプライ・メンション・フォロー申請・フォロー成立（`follow_approved`）の 6 つ
- `follow_approved` は 2 つの場面で使われている。承認不要の相手をフォローしたとき（宛先はフォローされた人）と、フォロー申請が承認されたとき（宛先は申請した人）。文言は種類だけで「あなたをフォローしました」に決まるため、後者では意味が逆になる
- DM（`Messaging::UseCases::SendMessage`）は `Emit` を通らず、未読バッジだけが付く
- 通知設定（`notifications.preferences`）はプロフィールごと。`push_enabled` はどこからも参照されず、種類ごとの設定はアプリ内通知を作るかどうかを切り替えている。リポスト・引用・推し！は対応する機能が無く、`post` は実際にはコメント通知を止めている
- アプリにログアウトの操作は無い。セッションを終えるのはアカウント削除（`deactivate`）だけ
- 本番は Lambda 同居構成で、外向き通信は IPv6 の egress-only internet gateway だけ。主な配信サーバー（`fcm.googleapis.com`・`web.push.apple.com`・`updates.push.services.mozilla.com`・`*.notify.windows.com`）は全て AAAA レコードを持つ
- Lambda は応答を返すと実行環境が止まるため、応答の後に裏で送る処理は当てにできない
- CloudFront は `/_next/static/*` だけをキャッシュする。`/sw.js` はキャッシュされない

### Decisions taken before this spec

| 論点 | 決定 | 理由 |
|---|---|---|
| 送る出来事 | アプリ内通知の全種類と DM | ユーザーの判断。DM はアプリ内の一覧には載せず、端末にだけ送る |
| フォロー申請の承認 | 申請した人に通知しない。`follow_approved` は `follow`（フォローされた）に改名する | ユーザーの判断。申請者は相手のプロフィールのボタンで承認を知れる。X も承認を通知しない（第三者の解説による。公式ヘルプには記述が無い） |
| 種類ごとの設定 | 端末への送信だけを止める。アプリ内の一覧には常に全て載る | ユーザーの判断。一覧を起きたことの記録として欠かさない |
| 複数プロフィール | 購読はアカウントと端末の組で持ち、アカウントの全プロフィール宛ての通知を送る。プロフィールごとの「端末に送る」（`push_enabled`）で止められる | ユーザーの判断 |
| 表示内容 | 誰が何をしたかに加えて、コメント・リプライ・メンション・DM の本文まで出す | ユーザーの判断 |
| 送信の時機 | 操作の処理の中で配信サーバーへ直接送る | ユーザーの判断。キューは #1640 で足す |
| 送信ライブラリ | `web-push` gem | 暗号化（RFC 8291）と VAPID 署名を自前で書かない |

## Goals

- 設定画面で「この端末で受け取る」を有効にした端末に、アカウントの全プロフィール宛ての通知と DM が届く
- 通知をタップすると、宛先のプロフィールに切り替わって対象の画面が開く
- 設定画面の項目が全て実際の動きと一致する

## Non-goals

- キューと再送（#1640）
- アプリのアイコンに出す未読数（Badging API）
- 端末の一覧や、他の端末の購読を消す画面

## Rules

### Who receives what

宛先プロフィール P への出来事 E について、次を全て満たすときに、P のアカウントの全ての購読へ送る。

1. P の `push_enabled` が ON
2. E の種類に対応する設定が ON（下表）
3. アプリ内通知の場合は、`Emit` の既存の条件（自分自身でない・ブロックされていない）を満たす。DM の場合は、送信が成功している

| 出来事 | 設定 |
|---|---|
| いいね | `like` |
| コメント | `comment` |
| リプライ | `reply` |
| メンション | `mention` |
| フォロー申請・フォロー | `follow` |
| DM | `message` |

アプリ内通知は、種類ごとの設定や `push_enabled` に関係なく常に作る。

### Follow notifications

- フォロー（`follow`）: 承認不要の相手をフォローしたとき、フォローされた人に送る
- フォロー申請（`follow_request`）: 承認が必要な相手をフォローしたとき、申請された人に送る
- フォロー申請の承認では、アプリ内通知も端末への通知も作らない
- 既に保存されている `follow_approved` の行は `follow` に改名する。承認の場面で作られた行も区別せずに改名する（今の表示と同じ文言のまま残るだけで、悪くはならない）

### Content

| 出来事 | 題名 | 本文 |
|---|---|---|
| いいね | 送った人の表示名 | あなたの投稿にいいねしました |
| コメント | 送った人の表示名 | あなたの投稿にコメントしました：（本文） |
| リプライ | 送った人の表示名 | あなたのコメントに返信しました：（本文） |
| メンション | 送った人の表示名 | あなたをメンションしました：（本文） |
| フォロー申請 | 送った人の表示名 | フォロー申請が届きました |
| フォロー | 送った人の表示名 | あなたをフォローしました |
| DM | 送った人の表示名 | （メッセージ本文） |

- 動作の文言はアプリ内通知（`frontend/src/modules/notifications/lib/format.ts`）と揃える。端末への通知は 1 件ずつ送るので「ほか N 人も」は付けない
- 本文は 100 文字で切り、切ったときは末尾に「…」を付ける。本文が空（画像だけのコメントなど）のときは「：（本文）」を付けない
- 宛先のアカウントに表示中のプロフィールが 2 つ以上あるときは、題名を「送った人 → 宛先のプロフィール」にする（例: 「りん → ゆな」）
- メンションの本文は、投稿でのメンションなら投稿の本文、コメントでのメンションならコメントの本文

### Destination

| 出来事 | 開く画面 |
|---|---|
| いいね | `/posts/<post_id>` |
| コメント・リプライ・メンション | `/posts/<target_post_id>` |
| フォロー申請 | `/u/<宛先の username>/requests` |
| フォロー | `/u/<送った人の username>` |
| DM | `/messages/<thread_id>` |

通知が持つ移動先は `/notifications/open?profile=<宛先のプロフィール ID>&to=<上表の画面>` にする。通知をタップすると、service worker がこの `profile` と `to` を使い捨ての記録として Cache Storage（`notification-open`）に保存し、`/notifications/open?id=<記録の ID>` を開く。保存するのは最後のタップの 1 件だけで、記録を保存できなかったときは `/notifications` を開く。

`/notifications/open` の画面は URL の `profile` と `to` を読まず、`id` の記録だけを使い、読んだ記録は消す。記録の `profile` が自分のアカウントの選べるプロフィールで、表示中と違えば切り替え、その後 `to` の画面へ置き換えで移る。`profile` が自分のアカウントで選べないプロフィール（無効化したもの、他人のもの、空）なら、切り替えずにホーム（`/`）を開く。表示中のプロフィールで対象の画面を開くと、足跡や既読がそのプロフィールで付くためである。`to` が `/` で始まらない、または `//` で始まるときは `/notifications` へ移る（他のサイトへ飛ばさない）。記録の無い URL は、切り替えずに `/notifications` を開く。

切り替えを URL ではなく service worker の記録からだけ行うのは、`/notifications/open?profile=…&to=…` のリンクは誰でも作れるためである。プロフィールの `website` や DM に置かれたそのリンクで切り替えると、開いた人のアカウントが別のプロフィール X も持っていれば、黙って X に切り替わって `to`（例えばリンクを置いた人のプロフィール）を開き、表示中だったプロフィール Y の直後に X の足跡が付く。これで X と Y が同じアカウントだと分かってしまう。アカウントのプロフィール同士のつながりを隠すことは、このプロダクトの前提である。

対象の画面を直接開かずにこの画面を挟むのは、切り替える前のプロフィールで対象の画面を一度でも描くと、足跡や既読がそのプロフィールで付くためである。

### Delivery

- 送信の窓口は `Notifications::UseCases::SendPush` 1 つにする。#1640 ではここをキューへの積み込みに差し替える
- 宛先アカウントの購読ごとに並列で送り、全ての結果を待ってから戻る。1 件あたりの待ち時間は接続・読み取りともに最大 3 秒
- TTL は 1 日。urgency は DM だけ `high`、他は `normal`
- 配信サーバーが 404 または 410 を返したら、その購読を消す
- それ以外の失敗と時間切れはログに残して握りつぶす（`// SILENT:`）。送信の失敗で元の操作を失敗させない
- VAPID 鍵が設定されていない環境では何も送らない（`// FALLBACK:`）

### Device subscription

- 「この端末で受け取る」は端末ごとの状態で、ブラウザに購読があるかどうかをそのまま表す
- 有効にする: 通知の許可を求め、VAPID 公開鍵で `PushManager.subscribe` し、購読を monolith に登録する
- monolith は、endpoint が https で、ホストが次のいずれかのときだけ登録する。任意の URL へサーバーから POST させないためである: `fcm.googleapis.com`、`web.push.apple.com` と `*.push.apple.com`、`updates.push.services.mozilla.com` と `*.push.services.mozilla.com`、`*.notify.windows.com`
- 解除は、そのアカウントが持つ購読だけを消す
- 無効にする: monolith から購読を消し、ブラウザの購読を解除する
- アプリを開いたとき、ブラウザに購読があれば monolith に登録し直す。同じ endpoint は 1 行だけ持ち、登録したアカウントに持ち主を付け替える。同じブラウザで別のアカウントにサインインした場合と、ブラウザが endpoint を更新した場合をこれで扱う
- 設定画面は、受け取れない理由を出し分ける

| 状態 | 表示 |
|---|---|
| ブラウザが Web Push に対応していない | この端末では受け取れません |
| iOS で、ホーム画面に追加した PWA として開いていない | ホーム画面に追加すると受け取れます |
| 通知の許可を拒否済み | ブラウザの設定で通知を許可してください |
| サーバーに VAPID 鍵が無い | この環境では受け取れません |

- アカウント削除では、そのアカウントの購読を全て消す

### Settings screen

| 区分 | 項目 |
|---|---|
| この端末 | この端末で受け取る |
| このプロフィール | 端末に通知を送る（`push_enabled`） |
| このプロフィールの種類ごと | いいね・コメント・リプライ・メンション・フォロー・メッセージ |
| その他 | 足跡の未読バッジ・足跡を残す（今のまま） |

種類ごとの項目は、`push_enabled` が OFF のとき操作できない。

## Architecture

### Data

`notifications.push_subscriptions`

| 列 | 型 | 制約 |
|---|---|---|
| `id` | uuid | 主キー（uuid v7） |
| `account_id` | uuid | NOT NULL、索引 |
| `endpoint` | text | NOT NULL、一意 |
| `p256dh` | text | NOT NULL |
| `auth` | text | NOT NULL |
| `created_at` / `updated_at` | timestamptz | NOT NULL |

`notifications.preferences` は次のとおり作り直す。

- `repost`・`quote`・`oshi` を消す
- `post` を `comment` に改名する
- 残りの列（`push_enabled`・`like`・`reply`・`follow`・`mention`・`message`・`footprint_unread_badge`・`footprints_record_my_visits`）はそのまま

`notifications.notifications` の `type` が `follow_approved` の行は `follow` に改名する。

### Proto (`notifications.v1`)

- `NotificationPreferences` から `repost`・`quote`・`oshi` を消して番号を `reserved` にし、`post` を `comment` に改名する
- `NotificationType` の `NOTIFICATION_TYPE_FOLLOW_APPROVED = 5` を `NOTIFICATION_TYPE_FOLLOW = 5` に改名する
- `NotificationService` に次の RPC を足す

| RPC | 入力 | 出力 |
|---|---|---|
| `GetPushConfig` | なし | `vapid_public_key`（base64url、鍵が無ければ空） |
| `RegisterPushSubscription` | `endpoint`・`p256dh`・`auth` | なし |
| `UnregisterPushSubscription` | `endpoint` | なし |

登録と解除は、表示中のプロフィールではなくアカウント（`Current.account_id`）に対して行う。

### Monolith

- `Notifications::Repositories::PushSubscriptionRepository`: endpoint での upsert、endpoint での削除、アカウントでの一覧と削除
- `Notifications::Adapters::WebPushSender`: `web-push` gem を包み、送信結果を「送れた・購読が無効・その他の失敗」に分けて返す
- `Notifications::UseCases::SendPush`: Rules の判定・本文の作成・並列送信・無効な購読の削除
- `Notifications::UseCases::Emit`: 種類ごとの設定でアプリ内通知を止めるのをやめる。アプリ内通知を作った後に `SendPush` を呼ぶ。本文は呼び出し側が `excerpt:` で渡す（コメント・リプライはコメントの本文、メンションは投稿かコメントの本文）
- `Messaging::UseCases::SendMessage`: メッセージを保存した後に `SendPush` を呼ぶ
- `Social::UseCases::Follows::Follow`: 承認不要のフォローで `follow` を送る。`ApproveFollowRequest` は通知を作らない
- アカウント削除（`Identity::UseCases::Account::PurgeIdentity`）で購読を全て消す
- 設定に `VAPID_PRIVATE_KEY`（PEM）と `VAPID_SUBJECT` を足す。どちらも任意で、無ければ送信しない。公開鍵は秘密鍵から計算する

### Frontend

- `public/sw.js`: `push` で通知を出し、`notificationclick` で既に開いているウィンドウを前に出して移動するか、新しく開く。開く先が `/notifications/open` のときは、`profile` と `to` を Cache Storage（`notification-open`）に使い捨ての記録として保存し、`/notifications/open?id=<記録の ID>` を開く
- BFF の route を 3 つ足す（設定の取得・購読の登録・購読の解除）
- 設定画面を Settings screen のとおりに作り直す
- アプリ内通知の文言と移動先（`modules/notifications/lib/format.ts`）を `FOLLOW` に合わせる
- `/notifications/open` の画面で、`id` の記録を読んで消し（`modules/notifications/lib/handoff.ts`）、記録に従ってプロフィールの切り替えと移動を行う。記録の無い URL では切り替えずに `/notifications` を開く。切り替えると AppShell がこの画面を作り直すので、読んだ記録は作り直しの後まで画面のモジュール内に `id` と組で持ち越す
- アプリを開いたときの購読の登録し直しを AppShell で行う

### Infrastructure (`dystopia/lambda`)

- VAPID 秘密鍵は `tls_private_key`（ECDSA P-256）で作り、`VAPID_PRIVATE_KEY` として app 用と task 用の両方の関数に渡す。`VAPID_SUBJECT` は `https://dystopia.city`
- この resource は入力を持たないので通常は作り直されない。作り直すと全ての端末の購読が無効になり、端末ごとに有効にし直す必要がある
- `prevent_destroy` は付けない。付けると Lambda 構成を消して元に戻す操作が止まる
- `dystopia/infrastructure` と kubernetes のマニフェストは変えない。EKS に戻すときに `VAPID_PRIVATE_KEY` と `VAPID_SUBJECT` を足す

## Testing

| 対象 | 確認すること |
|---|---|
| `SendPush`（rspec） | Who receives what の条件、題名と本文（宛先を添える場合・100 文字で切る場合・本文が空の場合）、開く URL、404/410 で購読が消えること、時間切れでも例外を出さないこと、鍵が無いと送らないこと |
| `Emit`（rspec） | 種類の設定が OFF でもアプリ内通知が作られ、端末には送られないこと |
| `SendMessage`（rspec） | 送信の後に DM の通知を送ること |
| フォロー（rspec） | 承認不要のフォローで `follow` が作られること、申請の承認では通知が作られないこと |
| 種類の改名（migration） | `follow_approved` の行が `follow` に改名されること（テスト DB に行を入れて migrate し、psql で確かめる） |
| 購読の repository と RPC（rspec） | 同じ endpoint を別のアカウントが登録すると持ち主が替わること、解除、アカウント削除で消えること |
| 設定（rspec・vitest） | 消した項目と改名した項目が proto・BFF・画面で揃っていること |
| 設定画面（vitest） | 受け取れない理由の出し分け、有効にする・無効にする操作 |
| `sw.js`（vitest） | 通知の表示内容、タップでの移動先 |
| `/notifications/open`（vitest） | 記録からの自分のプロフィールへの切り替えと、作り直しの後の移動、`profile`・`to` を付けて作った記録の無い URL では切り替えずに `/notifications` を開くこと、選べないプロフィール宛ての記録で切り替えずにホームを開くこと、不正な `to` の扱い、記録の読み取りと削除（`handoff.ts`） |
| AppShell（vitest） | アプリを開いたときの購読の登録し直し |
| 購読の登録（rspec） | 許可していないホスト・http・空の鍵を拒むこと |
| 実機（ローカル） | 鍵を作り、Chrome で購読して通知が届き、タップで対象の画面が開くこと |
| 実機（本番） | デプロイ後、iOS の PWA と Android またはデスクトップの Chrome に届くこと。Lambda から配信サーバーへの IPv6 接続はここで初めて確かめる |
