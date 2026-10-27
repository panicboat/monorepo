# Dystopia block, sign-up and billing design

## Context

Project 5 の Ready のうち、dystopia のアプリに関わる 6 件を、1 issue = 1 PR で gh stack に積んで片付ける。
対象は #1726、#1803、#1804、#1732、#1751、#1738 である。
#1768 と #1774（terragrunt の state key と GCP の階層）は、別の設計書で扱う。
#1809（鍵垢の再定義）は今回着手しない（ユーザーの判断）。

各 issue の本文に、問題の箇所（ファイルと行）が書かれている。
ただし規約・プライバシーポリシーの行番号は #1749 の書き直しより前のもので、ずれている。

### Decisions taken before this spec

ユーザーの判断:

- #1803: カルテは、ブロック関係やゲストの状態に関係なく、全キャストに見せ続ける。
  - 仕様書とポリシーは既にそう書いているので、変更なしで close する。
- #1804: ブロック後も、既存の DM のスレッドとメッセージは両者が閲覧でき、送信だけができない（今のまま）。
  - 仕様書は既にそう書いているので、変更なしで close する。
- #1751 + #1732: 登録を完了しなかった電話番号は、もう一度登録すればやり直せる。
  - 加えて、アカウントの行がない Cognito のユーザーは、作成から 1 日を過ぎたら日次の削除処理で消す。
- #1738: 解約後に再契約できるようにする。
  - 退会したら Stripe の購読を解約し、削除処理で課金の行を消す。
- 作業場所は新しい stack 用 worktree、設計書と plan は `docs/superpowers/` に置いて commit する。

## Goals

- 6 件の issue の Goal を満たす。
- `dystopia/docs/features/` の仕様書が、新しい動きを記述している。
- ブロックで何が見えなくなるかが、`follows-and-blocks.md` の 1 つの表にまとまっている。

## Non-goals

- #1768、#1774、#1809 の対応。
- 課金を本番で稼働させること。
- `billing.stripe_events`（Stripe の通知の記録）の保存期間を決めること。

## Anti-goals

- ブロックした相手に、予定タブ・予定検索・お知らせ投稿のどれか 1 つからでも予定が見えること。
- 登録をやり直す操作で、登録を完了したアカウント（`identity.accounts` の行があるもの）の Cognito ユーザーが消えること。
- 退会した利用者に、Stripe の請求が次の期間も続くこと。

## Stack

下から次の順に積む。
判断待ちの段はない。

1. #1726 `feat/dystopia-hide-schedules-from-blocked`（この設計書と plan もこの段に含める）
2. #1732 + #1751 `fix/dystopia-incomplete-sign-up`
3. #1738 `fix/dystopia-billing-resubscribe-and-purge`

- #1803 と #1804 は PR を作らず、決定をコメントして close する。
  - #1726 の段で書く `follows-and-blocks.md` の表に、カルテと DM の行を入れる。
- 2 と 3 はどちらも退会と削除処理（identity の slice、`account.md`）を触るため、この順で連続させる。

## Changes

### #1726 Block hides schedules

#### Behavior

- 予定の一覧（予定タブ）は、閲覧者とキャストがブロック関係（どちら向きでも）にあるとき、空を返す。
  - 判定は `Social` の `bidirectionally_blocked_profile_ids` を使い、予定検索（`discovery/use_cases/search_schedules.rb`）と同じ扱いにする。
  - 閲覧者は gRPC の `current_profile_id` から渡す。
  - 本人が自分の予定を見る場合は判定しない。
  - 閲覧者のプロフィールが決まらない場合（`current_profile_id` が空）は、空を返す（Claude の判断）。
    - 複数のプロフィールを持つアカウントが `x-profile-id` を付けずに呼ぶと空になり、どのプロフィールのブロックを当てるかが決まらないため。
    - 予定検索の同じ場合の扱い（ブロックを除外しない）は変えない。
- 画面は、空の予定タブを、予定のないキャストと同じ表示にする。
  - ブロック関係にあることを示す文言は出さない。

#### Specs and legal

- `follows-and-blocks.md` のブロックの表に、次の行を足す（既存の行は残す）。
  - プロフィールの閲覧: 制限しない（双方向で互いのプロフィールを見られる）。
  - 予定（予定タブ・予定検索）: 双方向で、キャストの予定が見えない。
  - DM: 既存のスレッドとメッセージは両者が閲覧できる。新しい送信はできない。
  - カルテ: 影響しない。
  - クチコミ・足跡・検索・おすすめ: 既存の Interactions の記述を表の行に移すかは builder の判断（重複させない）。
- `schedules.md` の「予定の見え方」の表で、ブロック関係の行の予定タブを「空になる」に変える。
- 利用規約の「予定と予定検索」の条（`terms.ts` の該当段落）に、ブロックの関係にあるプロフィールには予定が表示されないことを足す。
- 利用規約の「フォロー・ブロック・足跡」の条のブロックの段落に、キャストの予定が表示されなくなることを足す。
- プライバシーポリシーは、予定の表示先を規約の条に委ねているので変えない。

### #1732 + #1751 Incomplete sign-up

「登録を完了しなかったユーザー」は、Cognito にいて、その `sub` の `identity.accounts` の行がないユーザーをいう。
確認待ち（UNCONFIRMED）と、確認済みでアカウントの作成に失敗したもの（CONFIRMED）の両方を含む。

#### Re-registration

- 登録で Cognito が `UsernameExistsException` を返したら、その電話番号のユーザーが登録を完了しなかったユーザーかを調べる。
  - 該当すれば、そのユーザーを Cognito から消し、同じ要求で登録をもう一度行う（1 回だけ）。
  - 該当しなければ、今と同じ 409「この電話番号は既に登録されています」を返す。
- 調べて消す処理は monolith に置き、identity の gRPC に認証なしで呼べる RPC を足す。
  - 入力は Cognito のユーザー名（電話番号のハッシュ値。frontend の `lib/cognito/phone.ts` が計算する）。
  - monolith は Cognito の `ListUsers` をユーザー名で絞って状態と `sub` を得て、`identity.accounts` に行がなければ `AdminDeleteUser` で消す。
  - 新しい IAM 権限は要らない（`ListUsers` と `AdminDeleteUser` は Lambda の実行ロールと EKS の pod identity に既にある）。
  - ユーザー名は形式（SHA-256 の 16 進）を検証してから Cognito の filter に入れる。
- frontend の `CognitoAdapter` に、この処理を呼ぶメソッドを足す。
  - aws の実装は monolith の RPC を呼ぶ。
  - fake の実装は、メモリ上のユーザーに同じ判定（アカウントの行の有無は gRPC の `GetAccount` で確かめる）をして消す。
- monolith の gRPC は frontend からしか届かない（Lambda では同じコンテナの 127.0.0.1、EKS では HTTPRoute を持つのは frontend だけ）。
  - そのため、この RPC を呼べる経路は登録の API だけになる。
- 第三者が他人の電話番号で登録を繰り返すと、その番号の未完了の登録は作り直される。
  - 未完了の登録はログインにも使えないため、許容する。

#### Sign-in without an account

- 認証は通るがアカウントがない（`GetAccount` が NotFound）のログインは、401「電話番号または認証コードが正しくありません」を返し、認証で発行されたトークンをグローバルサインアウトで無効にする。
  - コードの既存の `if (!account)` の分岐と同じ応答にする。
  - テストは NotFound の ConnectError を投げるモックで書く。

#### Purge

- 日次の削除処理（毎日 04:00、Lambda の `{"task":"purge_deactivated"}` から呼ばれる `account:purge_deactivated` の rake task）に、登録を完了しなかったユーザーの削除を足す。
  - スケジュールと Lambda の入力は変えず、同じ呼び出しの中で 2 つの削除を順に実行する（Claude の判断）。
  - 両方を実行してから、どちらかに失敗があれば `abort` する。
  - 対象は、Cognito の作成日時が実行時刻の 24 時間前より前で、`identity.accounts` に行がないユーザーである。
  - 24 時間は確認コードの有効期間と同じで、確認の途中の利用者を消さない。
  - 退会の削除処理の後に実行する。
  - 消す直前に、そのユーザーの `sub` の行がないことを確かめ直す（`ListUsers` は結果整合のため）。
- 削除処理の途中で Cognito ユーザーだけが残ったアカウント（#1720 の状況）も、この処理で消える。
- `docs/superpowers/specs/2026-08-26-identity-cognito-migration-design.md` の不変条件（削除の起点を本人の退会と猶予の経過に限る）は、この 2 つの起点を足す形で改める。
  - 同じ設計書の猶予の日数（30 日）は、#1693 で 90 日に変わっているので、あわせて 90 日に直す。

#### Deactivation timestamp

- 退会の処理は、`deactivated_at` が空のときだけ書く。
  - 退会中のアカウントへの退会の要求は、何も変えずに成功を返す。

#### Specs and legal

- `account.md` の登録の表で、「認証コードを確認した後、アカウントの作成に失敗」の行を、同じ電話番号で登録をやり直せる動きに書き換え、「登録を完了しなかった電話番号で登録」の行を足す。
- `account.md` のログインの表で、「認証は通るがアカウントがない」の行を 401 とトークンの無効化に書き換える。
- `account.md` の退会の表に、退会中のアカウントへの退会の要求で退会日時が変わらないことを足す。
- `account.md` の削除処理と Data の節に、登録を完了しなかったユーザーの削除（作成から 24 時間）を書き、「確認待ちのまま残った登録の認証情報は、削除処理の対象ではない」を消す。
- プライバシーポリシーの「保存期間と削除」は変えない。
  - 「本サービスを提供するために必要な間保存します」の範囲に収まる（ユーザーの判断で保持期間を 1 日に決めたため）。

### #1738 Billing resubscription and purge

#### Resubscription

- `billing.subscriptions` は、1 アカウントにつき複数の行を持てるようにする。
  - `uq_billing_subscriptions_account_id` を外す migration を足し、`account_id` には一意でない index を張る。
  - 行は Stripe の購読 1 件につき 1 行で、`stripe_subscription_id` の一意制約は残す。
- アカウントの購読を 1 件だけ返す読み出しは、作成日時の新しい順で最初の行を返す。
  - 有効な購読の判定（`find_active_by_account_id`）は、全行のうち有効なものがあるかで決める。
- 照合（`billing:reconcile`）は、アカウントの全行のうち、`canceled` でない行と最新の行を Stripe と比べる。

#### Deactivation

- 退会したとき、そのアカウントの `canceled` でない購読を、Stripe で期間の終わりに解約する設定（`cancel_at_period_end`）にする。
  - 期間の途中で止めず、返金もしない。
  - 解約の対象がない場合は Stripe を呼ばない（課金が未稼働の本番では呼ばれない）。
  - Stripe の呼び出しが失敗したら、退会も失敗させて利用者に再試行させる。
- 退会中にログインして復活しても、解約の設定は戻さない。
  - 続けたい利用者は、顧客ポータルで解約を取り消すか、期間が終わってから再契約する。

#### Purge

- 削除処理は、アカウントごとに、課金の行がある場合、Stripe の顧客を削除してから、`billing.subscriptions` と `billing.customers` の行を消す。
  - Stripe の顧客を削除すると、残っている購読は即時に解約される。
  - 順番は、プロフィール、Web Push 購読、課金、Cognito、アカウントの行。
  - 課金で失敗したら、今の削除処理と同じく例外で止め、翌日にやり直す。
- 行を消した後に届いた Stripe の通知（顧客や購読の削除など）は、顧客の行が見つからなければ無視し、処理済みにする（500 を返さない）。

#### Specs

- `billing.md` に、再契約、退会時の解約、削除処理での扱いを書く。
- `account.md` の削除処理の順番に、課金を足す。
- 規約・ポリシーは、課金が未稼働のため変えない。

## Left to the builder

- RPC・メソッド・task の名前。
- 予定一覧に閲覧者を渡す方法（use case の引数を足すか、別の use case にするか）。
- `follows-and-blocks.md` の表の行の並びと文言（既存の Interactions と重複させない）。
- 削除処理で `ListUsers` を全件たどる実装（ページ送り、件数の上限）。
