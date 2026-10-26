# Dystopia ready fixes design

## Context

Project 5 の Ready にある fix のうち 11 件を、1 issue = 1 PR で gh stack に積んで片付ける。
対象は #1801、#1802、#1799、#1724、#1795、#1796、#1797、#1798、#1735、#1794、#1800 である。
#1732 と #1751（登録が途中で止まった Cognito ユーザー）と #1738（課金）は、別の設計で扱う。
#1720（削除処理が途中で失敗したアカウントの復活）は、後で再検討する（ユーザーの判断）。

各 issue の本文に、問題の箇所（ファイルと行）と仕様書の該当行が書かれている。
この設計書は、issue ごとに決めた動きと、それに合わせて直す仕様書を定める。

### Decisions taken before this spec

- 各 issue の直し方（実装を変えるか、仕様書を変えるか）は、下の Fixes に書いたとおりにする（ユーザーの判断）。
  - #1800 だけは実装を変えず、仕様書へ許容を書く。
  - #1724 は実装を変え、全角スペースだけの補足を保存する動きを書いた仕様書の行も書き換える。
- 作業場所は新しい worktree、設計書と plan は `docs/superpowers/` に置いて commit する（ユーザーの判断）。

## Goals

- 11 件の issue の Goal を満たし、`dystopia/docs/features/` の仕様書が新しい動きを記述している。
- 規約とプライバシーポリシーの文言は変えない。

## Non-goals

- #1720、#1732、#1751、#1738 の対応。

## Anti-goals

- 閲覧者が、件数・未読数・続きの有無から、自分に見えない相手や行の存在を推測できる状態を残すこと。

## Stack

下から次の順に積む。
判断待ちの段はない。

1. #1801 `fix/dystopia-cognito-adapter-fail-closed`（この設計書と plan もこの段に含める）
2. #1802 `fix/dystopia-feed-area-own-prefecture`
3. #1799 `fix/dystopia-karte-inactive-target`
4. #1724 `fix/dystopia-unicode-blank`
5. #1795 `fix/dystopia-deactivated-account-profile-ops`
6. #1796 `fix/dystopia-post-counts-exclude-blocked`
7. #1797 `fix/dystopia-footprint-unread-exclude-blocked`
8. #1798 `fix/dystopia-unread-exclude-inactive-senders`
9. #1735 `fix/dystopia-notification-distinct-actors`
10. #1794 `fix/dystopia-has-more-after-visibility`
11. #1800 `docs/dystopia-username-availability-disclosure`

- #1798、#1735、#1794 は通知の同じファイルを触るため、この順で連続させる。

## Fixes

### #1801 Cognito adapter selection

- `COGNITO_ADAPTER` は `aws` か `fake` のどちらかを明示しなければならない。
- 値が未設定、またはそれ以外のとき、Cognito の操作とトークン検証は例外を投げ、偽の実装にも偽の鍵にも切り替わらない。
  - 対象は `frontend/src/lib/cognito/adapter.ts` の `cognito()` と、`frontend/src/lib/cognito/jwks.ts` の検証の切り替えである。
- ローカル開発の手順（`dystopia/README.md` の seed の説明）は、`COGNITO_ADAPTER=fake` を指定する形に書き換える。
  - ローカルの起動手順や env の雛形が `COGNITO_ADAPTER` を設定していなければ、`fake` を追加する。
- テストは、未設定と未知の値で例外になることを確かめる。

### #1802 Area feed uses the viewer's prefecture

- エリアタブの絞り込みは、閲覧者のプロフィールの都道府県をサーバー側で引いて使う。
- フィードのリクエストから `prefecture` を削除する（proto、frontend の route、monolith の handler）。
- 閲覧者のプロフィールに都道府県がないときの扱いは、今の「都道府県が空のとき」の扱いをそのまま使う。
  - 今の扱いは builder がコードで確かめ、仕様書 `feed-and-ranking.md` に書かれていなければ書き足す。
- proto を変えた package の stub だけを commit する（bin/codegen は無関係な stub にも差分を出すため）。

### #1799 Karte list for an inactive guest

- 対象別のカルテ一覧（`karte/use_cases/list_kartes_by_target.rb`）は、対象のプロフィールが他人から見えない（無効化・退会中・削除済み）とき、NotFound を返す。
  - 一覧も集計も返さない。
- 最近のカルテ一覧と自分のカルテ一覧の動きは変えない（`karte.md:64`）。
- 仕様書 `karte.md:66-67` の「他人から取得できないため」が API の動きと一致する。

### #1724 Unicode whitespace counts as blank

- サーバーの空白の判定は、全角スペース（U+3000）を含む Unicode の空白文字を空白として扱う。
  - 対象は issue に挙がった判定のすべてである：表示名（作成・保存）、カルテとクチコミの補足、投稿の本文、予定のひとこと。
  - 空白の判定は 1 つの共通の関数に寄せ、各所はそれを使う。
  - 共通の関数を置く場所は、既存の `lib/` の helper の置き方に合わせる。
- 予定のひとことは、空白を除いた後の文字数で上限を判定する今の動きを、Unicode の空白にも広げる。
- 保存する値から前後の空白を取り除くかどうかは、今の動きを変えない。
  - 変えるのは「空白だけか」の判定だけである。
- 表示名の入力欄は、送信前に `trim()` した値で空かどうかを確かめ、空なら送らない。
- 仕様書は `profiles.md:25`、`karte.md:27`、`reviews.md:105` を、全角スペースだけの入力を空白として扱う動きに書き換える。

### #1795 Profile operations from a deactivated account

- 退会中のアカウントのトークンでは、プロフィールの作成・有効化・無効化・削除を拒否する。
  - 拒否は gRPC の `FAILED_PRECONDITION` とし、error-reason の metadata に `account_deactivated` を付ける。
  - 判定は 4 操作の入口で、アカウントの状態を引いて行う。
  - 認証の interceptor は変えない。
    - 全 RPC でアカウントを引く負荷をかけないため。
- 仕様書 `account.md:104` の例外（グローバルサインアウト後も有効期限まで 4 操作ができる）を削除する。
- frontend は、この拒否を既存の汎用のエラー表示で扱う。
  - 退会した端末では cookie が消えているため、この拒否に出会うのは古いトークンを持つ別の端末だけである。

### #1796 Post counts exclude the viewer's blocks

- 投稿の表示（一覧・1 件）のコメント数といいね数から、閲覧者がブロックしている相手のコメントといいねを除く。
  - 向きは、コメントの作成・削除の応答とコメント一覧（`get_blocked_profile_ids`、閲覧者がブロックした相手だけ）に揃える。
  - 閲覧者がいないとき（未ログイン）は、除外しない。
- 仕様書 `posts.md` に、コメント数・いいね数から閲覧者がブロックしている相手の分を除くことを書く。

### #1797 Footprint unread count excludes blocks

- 足跡の未読数は、一覧と同じく、ブロック関係（どちら向きでも）にある訪問者を除いて数える。
- 足跡の未読数は、一覧と同じく、プロフィールが他人から見えない訪問者（無効化されたプロフィール、退会中のアカウント）も除いて数える。
  - 未読数と一覧に出る訪問を一致させるため。
- 仕様書 `footprints.md:51-52` を、未読数が一覧に出る訪問だけを数える動きに書き換える。

### #1798 Unread counts exclude inactive senders

- 「他人から見える相手」とは、プロフィールが無効化されておらず、アカウントが退会中でない相手である（`visible_profiles` と同じ条件）。
- DM の未読数（スレッドごと・合計・スレッドの取得）は、他人から見える相手が送ったメッセージだけを数える。
  - 送信者が空のメッセージを数えない今の動きはそのまま残す。
- 通知の未読数は、発火者が他人から見える行だけを数える。
  - 一覧で非表示にする行の条件と、未読数で除く行の条件を一致させる。
- 相手が有効に戻れば、その分はまた未読に数えられる。
- 仕様書 `notifications.md:33` と `messages.md:39` を、この動きに書き換える。

### #1735 Notification actor count counts people

- 通知の 1 行ごとに、反応した人（発火者）を重複なしで記録する。
- 同じ受信者・種類・対象への発火のたびに、発火者がまだ記録されていなければ、件数を 1 増やし、最新の発火者・最新の日時・未読を今と同じく更新し、Web Push を送る。
- 発火者がすでに記録されていれば、種類ごとに次のように動く。
  - コメント・返信・メンションでは、件数と記録済みの発火者は変えず、最新の発火者・最新の日時・対象の投稿を更新し、未読に戻し、Web Push を送る。
    - 同じ人の 2 回目以降のコメント・返信・メンションにも、新しい内容があるため。
  - いいね・フォローとそれ以外の種類では、行を変えず、Web Push も送らない。
    - いいねの押し直しやフォローの解除・再フォローで、同じ人の通知が繰り返されないようにするため。
- 既存の行には、最新の発火者を記録済みの発火者として入れる。
  - 本番に利用者はいないため、既存の件数は直さない。
- 記録の持ち方（別の表か、配列の列か）は builder が決める。
  - 通知の行が削除されたら、記録も一緒に消える形にする。
- 仕様書 `notifications.md:24` に、件数が重複なしの人数であることと、同じ人の再発火での種類ごとの動きを書く。

### #1794 has_more after visibility filtering

- 閲覧判定で行を取り除く一覧は、見える行が「ページの件数 + 1」件そろうか、元の行が尽きるまで、続きを取得して埋める。
  - 続きの有無は、見える行が「ページの件数 + 1」件そろったかで決める。
  - 次のページのカーソルは、返した最後の見える行から作る。
- 対象は issue に挙がった 9 箇所である：投稿一覧、投稿の検索、フィード、コメント一覧、返信一覧、作者別コメント、いいねした投稿、クチコミ、通知。
  - ブックマークは対象外である（伏せた行として数えるため）。
- 足跡の一覧も、10 箇所目として同じ仕組みに切り替える。
- 埋める処理は 1 つの共通の仕組みに寄せる。
  - 既存の `Concerns::CursorPagination` に足すか、別に置くかは builder が決める。
- 1 回のリクエストで取得を繰り返す回数に上限は設けない。
  - 上限を設けると、上限に達したときに件数が足りないまま続きがあると返り、存在が推測できてしまうため。
- 仕様書 `feed-and-ranking.md:37`、`search.md:41`、`reviews.md:55` を、取り除いた後の件数で続きを判定する動きに書き換える。
  - 同じ挙動を書いているほかの仕様書の行があれば、あわせて書き換える。

### #1800 Username availability discloses only "taken"

- 実装は変えない。
- 仕様書 `profiles.md` に次を書く。
  - 空き確認は、無効化・退会中のプロフィールが使っている名前も「使用されています」と返す。
  - そのため、名前を使うプロフィールがあることは分かるが、そのプロフィールが有効かどうかは空き確認からは分からない。
  - 無効化したプロフィールが元のユーザー名に戻れることを優先し、この開示を許容する。

## Verification

- 各段で、変更したコードのテストを書く。
  - monolith は rspec、frontend は vitest と `tsc --noEmit --incremental false` で確かめる。
- 最上段で、monolith の rspec 全体と frontend の `next build` を通す。
- 仕様書の変更は Docs Sync Check の対象になるため、各段で仕様書を同じ PR に含める。
