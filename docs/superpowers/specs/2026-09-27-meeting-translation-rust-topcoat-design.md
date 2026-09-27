# meeting-translation の Rust/Topcoat 化 Design

Date: 2026-09-27
Status: Design spec (implementation-ready)
Scope: `tools/meeting-translation` を Rust の新興フルスタック web framework [Topcoat](https://github.com/tokio-rs/topcoat)(tokio-rs、2026-07 発表、experimental)で新規に作り直す。現行の Node/Fastify + React/Vite 実装は**挙動仕様の参照(何をすべきか)**としてのみ扱い、内部構造(モジュール分割・並行処理の実現方法・プロトコルのメッセージ形・テスト構成)は移植せず Rust/Topcoat に素直な形でゼロから設計する。最終的に現行実装を置き換える前提だが、実利用者がいない状態のため段階的な並行稼働は不要とする。

## Concept

Rust 導入の実験・学習台として、このリポジトリで最初の Rust コードベースをここに作る。現行アプリはリアルタイム音声認識・翻訳・字幕配信を伴う小規模だが技術要素の詰まったサービスであり、Topcoat の実地検証(ページ・生 WebSocket route・asset パイプライン)に適した対象と判断した。

- **動機**: Rust/Topcoat の実験・学習。パフォーマンス課題の解決が目的ではない
- **本番影響**: `dystopia.city/translate/` は稼働中だが実利用者がいないため、develop 環境と同等の慎重さで進めてよい
- **スコープ**: 音声処理を含め、可能な限り Rust 側に寄せる。ブラウザの低レベル Web API(マイク取得・AudioWorklet)だけはプレーン JS として残る
- **移植の進め方**: 段階導入ではなく、現行の全機能パリティ(=README に明記された挙動契約)を一度の実装計画で満たす
- **設計原則**: 現行 TypeScript 実装のコード構造(クラス設計・キュー処理・ファイル分割)は参照しない。満たすべきは「何をするか」であって「どう書いてあるか」ではない

## Topcoat の検証結果

実装前に [tokio-rs/topcoat](https://github.com/tokio-rs/topcoat) の examples とマージ済み issue を直接確認した(記憶で断定しない)。

| 確認事項 | 結果 | 根拠 |
|---|---|---|
| 生 WebSocket route を page と混在できるか | できる。`route(GET "/echo")` + `WebSocketUpgrade` | `examples/websocket/src/main.rs` |
| Binary メッセージのサポート | あり。`Message::Binary` | 同上 |
| サーバー起点の非同期 push(クライアント操作を起点としない) | `#[shard]+live!+broadcast` で可能(chat 例) | `examples/live/src/chat.rs` |
| カスタム JS の埋め込み | `asset!()` でプレーン JS ファイルを配信可能 | `examples/websocket/src/echo.js` |
| AWS SDK (Transcribe streaming / Bedrock runtime) | crates.io に存在(`aws-sdk-transcribestreaming` 1.120.0 / `aws-sdk-bedrockruntime` 1.147.0) | crates.io API |
| 成熟度 | "Early-stage and experimental. Expect breaking changes."。shard/live の websocket 対応(#443-#445)は 2026-09-24 マージ、関連バグ(#390)は 2026-09-26 close と非常に新しい | [announcement blog](https://tokio.rs/blog/2026-07-22-announcing-topcoat), GitHub issues |

## Decisions

| 項目 | 決定 | 理由 |
|---|---|---|
| リアルタイム経路の接続数 | 参加者ごとに **1本の生 WebSocket**(`route()+WebSocketUpgrade`) | 「1接続=1参加者の在室状態」という1:1対応がドメインとして最も単純。字幕配信だけ shard/live で別接続に分けると、「どちらの切断を退室とみなすか」という相関問題を新たに作ることになり、再接続猶予やleave即時破棄の要件を素直に満たせなくなる |
| shard/live! の使用範囲 | 今回のコア経路(join/audio/caption)では使わない | 接続分割のメリットよりドメインモデルの単純さを優先。shard/live 自体が直近マージの機能で安定性も未知数 |
| room の状態管理 | room ごとに専属の tokio task(actor)を立て、`mpsc` コマンドキューで排他制御する | Rust/tokio で「複数の非同期経路から1つの可変状態を安全に直列更新する」場合の標準的な形。手動のキュー+世代カウンタのような自前の直列化プリミティブを書く必要がなくなる(詳細は Concurrency Model 節) |
| ワイヤープロトコル | JSON(`serde` タグ付き enum)+ Binary(音声PCM)を1本の WebSocket に多重化する | クライアントもこのタイミングで作り直すため、外部互換性の制約はない。実装がシンプルで Topcoat の `Message::Text`/`Message::Binary` にそのまま乗る、という理由だけで採用する独立した設計判断 |
| `MEETING_BASE_PATH` 相当の base path | 環境変数にせず `/translate` をルート定義にリテラルで書く | Topcoat の `#[page("/...")]`/`#[route(... "/...")]` はコンパイル時文字列リテラル。この値が `/translate` 以外で使われたことは一度もなく、実行時可変性を持たせる理由がない |
| フロントエンド技術 | プレーン JS(型を書きたい場合は TypeScript を素の JS にコンパイル) | Topcoat は SSR 前提で、SPA 用のクライアントサイドルーティングやコンポーネントツリー構築を必要としない。React を持ち込む理由がない |
| ルーム作成〜参加画面の遷移 | `/rooms/:room_id` を独立した `#[page]` として実装 | Topcoat の SSR ページモデルでは、SPA の catch-all + 同一 HTML 返却という迂回が不要 |

## Architecture

新規 Rust バイナリクレートを `tools/meeting-translation` に構築する(現行 TS 実装を最終的に置き換える)。モジュール分割は Topcoat/Rust の書き方に沿って新規に決める(現行 TS のファイル分割に合わせる必要はない)。

```
tools/meeting-translation/          # Rust crate ルート(Cargo.toml)
├── src/
│   ├── main.rs                     # config読み込み・adapter構築・Router組み立て・起動
│   ├── config.rs                   # env var 読み込み(AWS_REGION/BEDROCK_MODEL_ID/TRANSLATION_GLOSSARY/PORT)
│   ├── pages/                      # #[page] 定義(作成フォーム・会議画面のHTMLシェル)
│   ├── session.rs                  # #[route]+WebSocketUpgrade の1接続ハンドラ、protocolのserde型
│   ├── room/                       # room actor(状態機械)・翻訳キュー・作成レート制限・registry(roomIdからactorへのSender引き当て)
│   └── adapters/                   # Translator/SpeechRecognizer trait + Bedrock/Transcribe実装
└── assets/                         # マイク取得・AudioWorklet・PCM resample・字幕描画のプレーンJS
```

## Data Flow

1. **起動**: `main()` が `config::load()`(必須env: `AWS_REGION`/`BEDROCK_MODEL_ID`/任意env: `TRANSLATION_GLOSSARY`/`PORT`)→ `BedrockTranslator`/`TranscribeRecognizer` を構築 → roomId から room actor の `mpsc::Sender` を引くための registry(Topcoat の `app_context` に載せ、全 page/route から参照する共有状態)を用意 → `Router::builder()` に page/route/assets を登録して `topcoat::start()`
2. **会議作成**: 作成者が `#[page("/translate/")]` のフォームを送信 → `#[route(POST "/translate/api/rooms")]` がレート制限(IPごと・10分window・上限5回)を通してから新しい room actor を起動し roomId + joinToken を発行(joinToken は sha256 ハッシュのみ保持)→ JSON 応答 → クライアントJSが `#<token>` フラグメント付きで `/translate/rooms/:room_id` へ遷移。トークンは URL フラグメントに留め、サーバーへ送らない
3. **会議画面**: `#[page("/translate/rooms/{room_id}")]` は HTML シェルのみ返す。ロード後、asset JS が `/translate/rooms/{room_id}/session` へ1本の WebSocket を張り、`join` メッセージ(roomId・token・displayName・speechLanguage・displayLanguage・consent)を送信
4. **セッション接続**(1参加者=1接続): 受信ループで `Message::Text` を serde で検証し、room actor へコマンドとして送る。`Message::Binary` はそのまま音声チャンクとして room actor(経由で participant の認識 task)へ渡す。ソケット close で「再接続猶予付き離脱」コマンドを送り(5秒)、`leave` メッセージ受信時は猶予なしの即時離脱コマンドを送る
5. **音声認識〜翻訳〜配信**: participant の認識 task から届く部分/確定テキストを room actor が受け取り、翻訳キューに投入(直列実行・10秒 timeout)。確定後、翻訳済み字幕を room 内の他参加者へ配信する
6. **確認要求**: ある字幕に対する確認要求は、room 全体には配信せず、その字幕を発話した参加者の接続にのみ通知する

## Protocol

JSON(`serde` タグ付き enum)でメッセージ種別を表現し、音声は `Message::Binary` にそのまま乗せる。これは現行プロトコルを踏襲する目的ではなく、Topcoat の WebSocket API(`Message::Text`/`Message::Binary`)にそのまま対応し実装が単純になるという理由で独立に採用する。

満たすべき制約(README の挙動契約から抽出、実装構造は問わない):

- 表示名は上限文字数を設ける(現行40文字)。手入力字幕の本文にも上限を設ける(現行2000文字)
- join は roomId・token・consent の3点を検証してから成立させる。token はハッシュ照合し、生の値をログに残さない
- 状態コード(不正メッセージ・満室・room不在・マイク利用不可・認識復旧/断・翻訳不可・再接続中)に相当する通知を持つ。文字列値そのものはクライアントとサーバーを同時に作り直すため自由に決めてよい

## Concurrency Model

room の状態(参加者一覧・字幕・翻訳キュー)は、room ごとに専属で立ち上げる **1本の tokio task(actor)** が単独で所有する。他のタスク(セッション接続のWS受信ループ、participant の認識 task)は、その actor の `mpsc::Sender<RoomCommand>` にコマンドを送るだけで直接状態に触れない。actor は自分の `mpsc::Receiver` をループで読み、コマンドを1件ずつ処理することで排他制御を実現する。これにより、TypeScript実装が必要としていた「participant ごとの operations キュー + generation カウンタ」のような手動の直列化プリミティブは不要になる(Rust/tokio では actor パターンがこの種の問題の標準的な解法であるため)。

- **音声認識の開始/停止**: room actor がブロックされないよう、participant ごとに専用の子 task を立てて Transcribe streaming セッションを管理する。room actor は「開始」「停止」コマンドをこの子 task に送るだけで、AWS 呼び出しの待ち時間が他 participant のコマンド処理を止めない
- **翻訳キュー**: room actor 内(または room ごとの子 task)で、字幕を1件ずつ `tokio::time::timeout` 付きで翻訳する。キューが空になる前に room が破棄される場合は、翻訳 task の `JoinHandle` を drop してキャンセルする(Rust の Future は drop で自然にキャンセルされるため、TS のような `AbortController`+`Promise.race` の手組みは不要)
- **再接続猶予**: participant 消滅から5秒後に room を破棄するかどうかは、room actor 内で `tokio::time::sleep` を使った猶予ロジックとして持たせる(タイマー管理を actor の外に出さない)

## Adapters

- `Translator` trait / `SpeechRecognizer` trait を Rust らしい形で定義する(非同期メソッド1〜2個程度のシンプルな trait)
- `Translator` は `aws-sdk-bedrockruntime` で実装する。プロンプトには文脈(直近の確定字幕)と用語集を含める
- `SpeechRecognizer` は `aws-sdk-transcribestreaming` の bidirectional stream で実装する。部分/確定テキストや再接続状態は `tokio::sync::mpsc` 経由のイベントとして呼び出し元(participant の認識 task)に流す
- 正確な crate バージョン・API シグネチャは実装時に Cargo.lock と docs.rs で確認してから使う(この spec では確認済みの crate 存在のみを前提とする)

## Browser Layer

マイク取得(`getUserMedia`)・`AudioWorklet` での PCM 変換・リサンプリング・WebSocket 送受信・字幕描画・手入力字幕フォーム・確認要求 UI を、フレームワークなしのプレーン JS として新規に書く。現行の React 実装は「何を表示し、何を送受信するか」という仕様の参照にとどめ、コンポーネント構造や状態管理の実装をそのまま踏襲しない。`asset!()` で配信する。

## Error Handling & Logging

- クライアントへの状態通知は、状況ごとに区別できる形を維持する(不正メッセージ・満室・room不在・マイク利用不可・認識復旧/断・翻訳不可・再接続中)
- ログは event code と非機密 ID のみに限定し、音声・transcript・caption・join token・AWS credentials は一切出力しない(`tracing` crate で構造化フィールドを絞る)
- 意図的なフォールバック(例: 音声処理不可時の手入力字幕による継続)や、意図的に握りつぶすエラー(例: ソケットが閉じた後の送信失敗)には `// FALLBACK:`/`// SILENT:` を付ける

## Deployment

- Dockerfile はマルチステージの Rust ビルド(builder: `cargo build --release`、runner: 生成バイナリ + asset ディレクトリのみをコピー)に新規で書く。非 root ユーザー実行は維持する
- Kubernetes 側(`deployment.yaml`/`httproute.yaml`/`serviceaccount.yaml`、single replica の `Recreate` 戦略、Pod Identity 経由の AWS 権限)は言語非依存のため変更不要
- `kubernetes/base/configmap.yaml` から `MEETING_BASE_PATH` を削除する
- AWS 側の前提(Bedrock model access・Transcribe/Bedrock への IAM 権限)は変更なし

## Testing

README に明記された挙動契約(最大3人・5秒再接続猶予・即時leave破棄・再参加時の字幕再送なし・join tokenのhash照合・レート制限・ログ制限等)を仕様として、Rust 側で `#[tokio::test]` によるテストを新規に書く。現行の vitest ファイル構成やテストケース粒度を踏襲する必要はなく、Rust/tokio でのテストしやすさ(actor へのコマンド送信と結果の観測)に合わせて設計する。

ブラウザ側ロジック(PCM resample・字幕表示・room link 生成・状態文言・確認要求文言)も、ロジックとして独立させたうえで新規にユニットテストを書く。

最終確認として、README にある実運用手順(ローカルで会議作成 → 2ブラウザで参加 → 音声 → 字幕 → 翻訳 → 切断 → 再接続)を dogfooding し、挙動契約が満たされていることを確認する。

## Risks

- Topcoat は "Early-stage and experimental. Expect breaking changes." と公式に明記されている。特に生 WebSocket route(`examples/websocket`)は本 spec のコア機能として直接依存するため、実装中に破壊的変更へ追随する可能性がある
- shard/live! の websocket 対応は 2026-09-24 マージされたばかりで、関連バグ(#390)も 2026-09-26 close と直近。本 spec ではコア経路に使わない判断をしたため直接の影響は小さいが、Topcoat 自体の内部実装がこの機能と共有している可能性はある
- AWS Rust SDK(`aws-sdk-transcribestreaming`)の bidirectional streaming API は、TypeScript SDK とは型シグネチャ・エラー種別が異なる可能性が高く、再接続ロジックの実装には追加調査が要る

## Out of Scope

- 段階的な並行稼働・機能ごとの分割リリース(一度の実装計画で全機能パリティを目指す方針のため)
- PCM リサンプリング等の音声 DSP を wasm-bindgen で Rust 化する追加最適化(必要になれば別途検討)
- Topcoat の `shard`/`live!` を用いた将来的な字幕配信の再設計(本 spec でコア経路に不採用とした判断を覆す場合は別途 spec を起こす)
