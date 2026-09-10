# Final Fix Report

## Status

レビューの Important 6 項目を修正した。preview reducer と README trailing slash の minor 指摘は、今回の安全性修正と独立しているため変更していない。

実装 commit は `b937e51bb3a800ffc6d81ef69baf455c1c044058` (`fix(meeting-translation): own provider failure lifecycles`)。`Signed-off-by` を含み、`Co-Authored-By` は含まない。

## Changed Files

- Server adapter: `contracts.ts`、`transcribe-recognizer.ts` と test、`bedrock-translator.ts` と test。
- Room lifecycle: `meeting-room.ts` と test、`translation-queue.ts` と新規 test。
- Shared protocol: `meeting.ts`。
- Browser: `entry-form.tsx`、`manual-caption-form.tsx` と新規 test、`meeting-socket-client.ts` と test、`use-meeting-socket.ts`、`status-copy.ts` と test。
- Evidence: 本 report。

## Design Decisions

- Transcribe adapter が provider retry を所有する。再接続可能な 429、503、`LimitExceededException`、`ServiceUnavailableException` に対し、250、500、1,000、2,000、4,000 ms の待機後に新しい client と audio queue で再開する。
- 各 recognition attempt は専用の queue、`AbortController`、client を持つ。失敗時は queue の保留音声を破棄し、request を abort し、client を破棄してから次の attempt を開始する。retry wait 中の音声は保持せず破棄するため、古い音声を新しい stream へ送らない。
- `RecognitionSession.stop()` は現行 request と retry wait を abort し、session loop の終了を待つ。意図的停止では `recognition_unavailable` を通知しない。非再接続エラー、予期しない stream EOF、retry 枯渇では provider detail を含まない `recognition_unavailable` を通知する。
- retry 開始時は `reconnecting`、新 stream 接続時は `recognition_available` を配信する。復旧後に UI が reconnecting 表示を残さないためである。
- Translation queue は request ごとの `AbortSignal` と 10 秒 timeout を所有する。timeout 後は source text を保持した failed caption を配信して次 job へ進む。room destruction の `clear()` は queued job を削除し、active request を abort し、遅着 callback を無効化する。
- 手入力の socket send は boolean を返し、room join 完了前、切断中、または `WebSocket.send` 失敗時に false を返す。form は false の場合に入力を保持し、再接続後の再送を案内する。
- 同意文は日本語・英語とも、外部サービスの Amazon Transcribe と Amazon Bedrock へ音声と字幕を送信し、文字起こしと翻訳を処理することを明記する。

## AWS SDK Evidence

インストール済み `@aws-sdk/client-bedrock-runtime@3.1128.0` の型を確認した。

- `dist-types/models/models_0.d.ts` の `ConverseResponse` は `stopReason: StopReason | undefined` を持つ。
- `dist-types/models/enums.d.ts` の `StopReason.MAX_TOKENS` は `"max_tokens"` である。
- `ConverseCommandOutput` は `ConverseResponse` を継承する。
- インストール済み Smithy の `HttpHandlerOptions` は `abortSignal` を受け付ける。`BedrockRuntimeClient.send(command, { abortSignal })` は typecheck で検証した。

この契約に基づき、text block が存在しても `stopReason === "max_tokens"` の response は成功扱いせず、translation failure として source text を保持する。

## TDD Evidence

最初の focused RED run は既存 120 tests が通過し、新規 10 tests が未実装の理由で失敗した。

- Transcribe: 恒久 error cleanup、予期しない EOF cleanup、再接続時の新 queue/client、retry wait の stop cancellation。
- Bedrock: `max_tokens` response の拒否。
- Translation queue: hung request timeout と room cleanup cancellation。
- Browser: manual send result と入力保持。

追加の RED/GREEN cycle で次の競合も確認した。

- room join 前の open socket が manual caption を誤って成功扱いした。
- 意図的 audio stop 後の遅着 final transcript が caption を作成した。
- reconnect 成功後に server status が reconnecting のまま残った。
- error cleanup 後の旧 audio queue に queued chunk が残った。
- socket state 競合で `WebSocket.send` が throw すると入力 form まで例外が伝播した。

## Verification

- `pnpm test` — 20 files、135 tests passed。
- `pnpm typecheck` — exit 0。
- `pnpm build` — Vite web build と server TypeScript build が成功し、`dist/server/main.js` を確認した。
- `git diff --check` — exit 0。

## Limitations

- 実 AWS credential、Amazon Transcribe stream、Amazon Bedrock inference は実行していない。
- 実ブラウザの microphone、ネットワーク切断、Zoom との併用は確認していない。
- timeout 後の provider request の停止は `AbortSignal` を尊重する provider client に依存する。queue 自体は timeout または room destruction で待機を終了し、遅着結果を配信しない。
