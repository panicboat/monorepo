# Meeting Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zoom と並行して利用できる、最大 3 人向けの日英双方向リアルタイム翻訳字幕アプリを追加する。

**Architecture:** `dystopia/meeting-translation` に、React/Vite の公開 Web UI と Fastify/WebSocket のリアルタイム API を同居させた独立サービスを作る。サービスが各参加者の PCM 音声を Amazon Transcribe Streaming へ中継し、確定原文を順序保証付きで Amazon Bedrock に送って字幕イベントを配信する。会議状態はプロセス内だけに置き、最後の参加者が退出した時点で破棄する。

**Tech Stack:** Node.js 24.20.0, TypeScript 6.0.3, React 19.2.8, Vite 8.2.2, Vitest 4.1.11, Fastify 5.12.3, `@fastify/websocket` 11.3.0, `@fastify/static` 10.1.3, AWS SDK for JavaScript v3 3.1128.0, Amazon Transcribe Streaming, Amazon Bedrock Converse API, Kubernetes, Terraform, Flux CD.

**Spec:** `docs/superpowers/specs/2026-09-10-meeting-translation-design.md`

## Global Constraints

- 参加者は最大 3 人とし、各自が表示名、発話言語、表示言語を指定する。対応言語は `ja-JP` と `en-US` だけとする。
- Zoom API、Zoom の混合音声、翻訳音声を扱わない。各参加者は Zoom と本アプリで自分のマイクを使う。
- ブラウザへ AWS 認証情報を渡さない。Pod Identity を持つサービスだけが AWS API を呼び出す。
- 参加トークンは URL fragment にだけ置く。HTTP URL、ログ、永続ストレージへ音声・原文・訳文・トークンを保存しない。
- Amazon Transcribe の途中結果は発話者だけに表示し、Bedrock には確定原文だけを渡す。字幕は原文と訳文を照合可能にする。
- 翻訳は確定原文の順序で 1 会議ごとに直列化し、直近 12 発話だけを Bedrock 文脈へ含める。通常の発話終了から確定訳文の表示は 3 秒以内を目標にする。
- 音声認識または翻訳が失敗した時は、接続状態を表示し、手入力による翻訳を同じ字幕欄へ送る。実装中のフォールバック分岐には `// FALLBACK:` コメントを置く。
- 意図的に無視する切断・クリーンアップエラーには `// SILENT:` コメントを置く。コード内の識別子・コメント・コミットメッセージは英語にする。
- ドキュメント見出しは英語、本文は日本語にする。依頼範囲外の既存サービスのリファクタリングや依存追加をしない。
- 各タスクはテストを先に失敗させ、最小実装で成功させる。コミットは `git commit -s` を使い、`Co-Authored-By` を付けない。

---

## File Structure

```text
dystopia/meeting-translation/
├── package.json                         # 独立サービスのスクリプトと依存関係
├── pnpm-lock.yaml                       # このサービスの依存解決結果
├── tsconfig.json                        # server と web の型検査設定
├── tsconfig.server.json                 # Node.js 実行コードの出力設定
├── vite.config.ts                       # React ビルドと開発時 proxy
├── Dockerfile                           # Node.js 24 の本番コンテナ
├── .dockerignore                        # コンテナ build context の除外規則
├── README.md                            # 利用方法、必要な AWS 設定、検証手順
├── src/
│   ├── shared/
│   │   ├── meeting.ts                   # 会議、字幕、言語の共有型
│   │   └── protocol.ts                  # WebSocket の入力検証とイベント型
│   ├── server/
│   │   ├── config.ts                    # 環境変数の検証
│   │   ├── app.ts                       # Fastify の組立てと HTTP route
│   │   ├── main.ts                      # 起動、シグナル処理、停止
│   │   ├── room/
│   │   │   ├── room-registry.ts         # room ID、トークン、参加上限、状態破棄
│   │   │   ├── meeting-room.ts          # 参加者、字幕順序、確認要求、短期文脈
│   │   │   ├── translation-queue.ts     # 会議単位の翻訳直列化
│   │   │   └── room-creation-limiter.ts # 未認証の作成 API の時間窓制限
│   │   ├── adapters/
│   │   │   ├── contracts.ts             # Translator と SpeechRecognizer の境界
│   │   │   ├── bedrock-translator.ts    # Bedrock Converse 呼出し
│   │   │   └── transcribe-recognizer.ts # Transcribe Streaming の開始と停止
│   │   └── transport/
│   │       └── websocket-route.ts       # binary audio と JSON event の接続処理
│   └── web/
│       ├── index.html                   # Vite entry
│       ├── main.tsx                     # React mount
│       ├── app.tsx                      # 作成、参加、会議画面の切替
│       ├── styles.css                   # 独立サービスの画面スタイル
│       ├── lib/
│       │   ├── caption-display.ts        # 表示言語に応じた原文・訳文の選択
│       │   ├── pcm.ts                    # Float32 sample から 16-bit PCM への変換
│       │   └── room-link.ts              # fragment を含む共有リンクの生成
│       ├── hooks/
│       │   ├── use-meeting-socket.ts     # 接続、再接続、イベント状態
│       │   └── use-microphone.ts         # AudioWorklet の開始・停止・track 解放
│       ├── audio/
│       │   └── pcm-processor.ts          # 16 kHz mono PCM を出す AudioWorklet
│       └── components/
│           ├── entry-form.tsx            # 表示名、言語、同意、共有リンク
│           ├── meeting-view.tsx          # 字幕、接続状態、参加者、マイク操作
│           ├── caption-list.tsx          # 原文展開と確認要求
│           └── manual-caption-form.tsx   # 音声処理が使えない時の入力
├── kubernetes/
│   ├── base/
│   │   ├── configmap.yaml                # 非機密の実行設定
│   │   ├── deployment.yaml               # 1 replica、probe、Pod Identity
│   │   ├── service.yaml                  # HTTP/WebSocket service
│   │   ├── serviceaccount.yaml           # Pod Identity の対象
│   │   ├── httproute.yaml                # dystopia.city/translate の経路
│   │   └── kustomization.yaml
│   └── overlays/production/
│       ├── deployment.yaml               # Flux が書き換える image tag
│       └── kustomization.yaml
├── src/**/*.test.ts                      # server、adapter、browser helper のテスト
└── ../infrastructure/aws/modules/pod_identity.tf
                                             # 実行 role、最小 IAM policy、association
```

クラスタ側では `clusters/production/dystopia/meeting-translation/` に Flux の ImageRepository、ImagePolicy、ImageUpdateAutomation、Kustomization を追加し、`clusters/production/dystopia/kustomization.yaml` と `release-please-config.json` へ新サービスを登録する。

## Tasks

### Task 1: Service Scaffold and Protocol Contracts

**Files:**
- Create: `dystopia/meeting-translation/package.json`
- Create: `dystopia/meeting-translation/tsconfig.json`
- Create: `dystopia/meeting-translation/tsconfig.server.json`
- Create: `dystopia/meeting-translation/vite.config.ts`
- Create: `dystopia/meeting-translation/src/shared/meeting.ts`
- Create: `dystopia/meeting-translation/src/shared/protocol.ts`
- Create: `dystopia/meeting-translation/src/shared/protocol.test.ts`
- Create: `dystopia/meeting-translation/src/server/config.ts`
- Create: `dystopia/meeting-translation/src/server/config.test.ts`

**Interfaces:**
- Produces `SpeechLanguage = "ja-JP" | "en-US"`, `DisplayLanguage = "ja" | "en"`, `Caption`, `Participant`, and `ServerMessage` from `src/shared/meeting.ts`.
- Produces `parseClientMessage(value: unknown): ParseResult<ClientMessage>` and `serializeServerMessage(message: ServerMessage): string` from `src/shared/protocol.ts`.
- Produces `loadConfig(env: NodeJS.ProcessEnv): ServiceConfig` from `src/server/config.ts`.
- Later tasks consume the exact message types `join`, `audio:start`, `audio:stop`, `caption:manual`, `clarification:request`, and `leave`.

- [ ] **Step 1: Create the service package and type-check scripts**

Create `package.json` with the exact runtime dependencies `@aws-sdk/client-bedrock-runtime@3.1128.0`, `@aws-sdk/client-transcribe-streaming@3.1128.0`, `@fastify/static@10.1.3`, `@fastify/websocket@11.3.0`, `fastify@5.12.3`, `react@19.2.8`, and `react-dom@19.2.8`. Add development dependencies `@fastify/websocket`'s required `@types/ws@8.18.1`, `@types/node@24.13.3`, `@types/react@19.2.18`, `@types/react-dom@19.2.7`, `@vitejs/plugin-react@6.1.1`, `concurrently@10.0.5`, `tsx@4.23.13`, `typescript@6.0.3`, `vite@8.2.2`, and `vitest@4.1.11`.

Define these scripts:

```json
{
  "build": "pnpm build:web && pnpm build:server",
  "build:web": "vite build",
  "build:server": "tsc -p tsconfig.server.json",
  "dev": "concurrently -k -n web,server \"pnpm run dev:web\" \"pnpm run dev:server\"",
  "dev:web": "vite --host 0.0.0.0",
  "dev:server": "PORT=3001 tsx watch src/server/main.ts",
  "start": "node dist/server/main.js",
  "test": "vitest run",
  "typecheck": "tsc --noEmit -p tsconfig.json"
}
```

Use Vite `base: "/translate/"` and a development proxy for `/translate/api` and `/translate/ws` to `http://localhost:3001`. Configure `tsconfig.server.json` with `module` and `moduleResolution` both set to `NodeNext`, `outDir` set to `dist/server`, and `noEmit` disabled. Configure the root `tsconfig.json` to type-check both `src/server` and `src/web` without producing output.

- [ ] **Step 2: Install the lockfile-resolved dependencies and write failing protocol tests**

Run:

```bash
pnpm install
pnpm test -- src/shared/protocol.test.ts src/server/config.test.ts
```

Write tests for the following contract before creating its implementation:

```ts
expect(parseClientMessage({
  type: "join",
  roomId: "room_123",
  token: "token_123",
  displayName: "Ken",
  speechLanguage: "ja-JP",
  displayLanguage: "ja",
  consent: true,
})).toEqual({ ok: true, value: expect.objectContaining({ type: "join" }) });

expect(parseClientMessage({ type: "join", consent: false })).toEqual({
  ok: false,
  code: "invalid_message",
});

expect(() => loadConfig({
  AWS_REGION: "ap-northeast-1",
  BEDROCK_MODEL_ID: "",
  MEETING_BASE_PATH: "/translate",
})).toThrow("BEDROCK_MODEL_ID is required");
```

Expected: FAIL because the contract and configuration modules do not exist.

- [ ] **Step 3: Implement the shared types, strict parsers, and configuration loader**

Define the canonical caption and WebSocket protocol:

```ts
export interface Caption {
  id: string;
  sequence: number;
  speaker: Participant;
  sourceLanguage: SpeechLanguage;
  sourceText: string;
  translatedText?: string;
  kind: "speech" | "manual";
  state: "translating" | "final" | "failed";
  createdAt: number;
}

export type ClientMessage =
  | { type: "join"; roomId: string; token: string; displayName: string; speechLanguage: SpeechLanguage; displayLanguage: DisplayLanguage; consent: true }
  | { type: "audio:start" }
  | { type: "audio:stop" }
  | { type: "caption:manual"; text: string }
  | { type: "clarification:request"; captionId: string }
  | { type: "leave" };

export type ServerMessage =
  | { type: "room:joined"; participantId: string; participants: Participant[] }
  | { type: "participant:joined" | "participant:left"; participant: Participant }
  | { type: "caption:preview"; speakerId: string; sourceText: string }
  | { type: "caption:pending" | "caption:final" | "caption:failed"; caption: Caption }
  | { type: "clarification:requested"; captionId: string; requester: Participant }
  | { type: "status"; code: "invalid_message" | "room_full" | "room_not_found" | "microphone_unavailable" | "recognition_unavailable" | "translation_unavailable" | "reconnecting" };
```

Reject unknown message keys, a false or absent `consent`, names longer than 40 characters, manually entered text longer than 2,000 characters, and any language outside the two declared values. Keep browser-visible status values as stable codes such as `microphone_unavailable`, `recognition_unavailable`, `translation_unavailable`, and `reconnecting`; the client localizes those codes.

`loadConfig` must require `AWS_REGION`, `BEDROCK_MODEL_ID`, and `MEETING_BASE_PATH`; require the base path to start with `/`; and parse an optional newline-separated `TRANSLATION_GLOSSARY` into a string array. Do not include any AWS credentials in `ServiceConfig`.

- [ ] **Step 4: Run focused tests and type-check**

Run:

```bash
pnpm test -- src/shared/protocol.test.ts src/server/config.test.ts
pnpm typecheck
```

Expected: PASS. The tests prove invalid public inputs cannot enter the room coordinator and no client configuration has AWS credentials.

- [ ] **Step 5: Commit the scaffold and contracts**

```bash
git add dystopia/meeting-translation/package.json dystopia/meeting-translation/pnpm-lock.yaml dystopia/meeting-translation/tsconfig.json dystopia/meeting-translation/tsconfig.server.json dystopia/meeting-translation/vite.config.ts dystopia/meeting-translation/src/shared dystopia/meeting-translation/src/server/config.ts dystopia/meeting-translation/src/server/config.test.ts
git commit -s -m "feat(meeting-translation): add service contracts"
```

### Task 2: Ephemeral Room Coordination and Ordered Captions

**Files:**
- Create: `dystopia/meeting-translation/src/server/adapters/contracts.ts`
- Create: `dystopia/meeting-translation/src/server/room/room-creation-limiter.ts`
- Create: `dystopia/meeting-translation/src/server/room/translation-queue.ts`
- Create: `dystopia/meeting-translation/src/server/room/meeting-room.ts`
- Create: `dystopia/meeting-translation/src/server/room/room-registry.ts`
- Test: `dystopia/meeting-translation/src/server/room/room-registry.test.ts`
- Test: `dystopia/meeting-translation/src/server/room/meeting-room.test.ts`

**Interfaces:**
- Consumes `Caption`, `ClientMessage`, `Participant`, and `SpeechLanguage` from Task 1.
- Produces `Translator.translate(request: TranslationRequest): Promise<string>` and `SpeechRecognizer.start(options: RecognitionOptions): RecognitionSession`.
- Produces `RoomRegistry.create(): CreatedRoom`, `RoomRegistry.join(connection, message): JoinResult`, `RoomRegistry.disconnect(participantId): Promise<void>`, and `RoomRegistry.destroyAll(): Promise<void>`.
- Later transport code calls these methods and never accesses a `MeetingRoom` map directly.

- [ ] **Step 1: Write failing room lifecycle and ordering tests**

Create deterministic in-test fakes for `Translator`, `SpeechRecognizer`, and a `RoomConnection` that records serialized server messages. Cover these cases:

```ts
it("accepts three participants and rejects a fourth", () => {
  const created = registry.create();
  expect(join(created, "A").ok).toBe(true);
  expect(join(created, "B").ok).toBe(true);
  expect(join(created, "C").ok).toBe(true);
  expect(join(created, "D")).toEqual({ ok: false, code: "room_full" });
});

it("keeps a later completed translation after an earlier pending caption", async () => {
  recognizer.emitFinal("speaker-a", "最初の発話");
  recognizer.emitFinal("speaker-b", "second utterance");
  await translator.resolveInRequestOrder("first translation", "second translation");
  expect(captions(connection)).toMatchObject([
    { sequence: 1, state: "final" },
    { sequence: 2, state: "final" },
  ]);
});
```

Also test token mismatch rejection, a join message without consent, a clarification request broadcast to the original speaker, removal of a disconnected participant, recognition stop on audio stop, and room deletion only after the final participant leaves.

Expected: FAIL because room coordination modules do not exist.

- [ ] **Step 2: Implement adapter contracts and the room registry**

Create these exact provider-neutral boundaries:

```ts
export interface TranslationRequest {
  sourceText: string;
  sourceLanguage: SpeechLanguage;
  targetLanguage: SpeechLanguage;
  context: readonly Caption[];
  glossary: readonly string[];
}

export interface Translator {
  translate(request: TranslationRequest): Promise<string>;
}

export interface RecognitionSession {
  write(chunk: Uint8Array): void;
  stop(): Promise<void>;
}

export interface RecognitionOptions {
  language: SpeechLanguage;
  onPartial(text: string): void;
  onFinal(text: string): void;
  onError(code: "recognition_unavailable"): void;
}

export interface SpeechRecognizer {
  start(options: RecognitionOptions): Promise<RecognitionSession>;
}

export interface RoomConnection {
  send(message: ServerMessage): void;
}

export interface CreatedRoom {
  roomId: string;
  joinToken: string;
}

export type JoinResult =
  | { ok: true; participant: Participant }
  | { ok: false; code: "invalid_message" | "room_full" | "room_not_found" };
```

`RoomRegistry.create` must generate a UUID room ID and a 32-byte `base64url` join token. Store only `sha256(joinToken)` in the `MeetingRoom`, compare token hashes with `timingSafeEqual`, and return the raw token only in the `CreatedRoom` response. Keep all rooms in one `Map<string, MeetingRoom>`; do not create database, cache, or object-storage writes.

Use a `RoomCreationLimiter` with a process-local, IP-keyed 10-minute window and a limit of five successful creations. When a room becomes empty, call `MeetingRoom.destroy`, stop every active recognition session, clear its 12-item context array and translation queue, and delete it from the registry.

- [ ] **Step 3: Implement caption sequencing, short context, and manual input**

`MeetingRoom` must issue a monotonically increasing `sequence` and broadcast a `caption:pending` event as soon as it receives a finalized source transcript. `TranslationQueue` must process one `TranslationRequest` at a time per room. It updates the matching caption to `final` only after `Translator.translate` resolves, appends the final caption to the 12-item context, and then processes the next item.

Use the participant's declared language as the source language and the opposite language as the target. `caption:manual` must create the same pending caption and enter the same queue:

```ts
// FALLBACK: typed captions keep the meeting usable while audio processing is unavailable.
await room.enqueueCaption({
  speaker: participant,
  sourceLanguage: participant.speechLanguage,
  sourceText: message.text,
  kind: "manual",
});
```

When recognition or translation rejects, retain the source text, set the caption state to `failed`, and broadcast a status code. Do not retry a translation implicitly because a duplicate caption may change meeting meaning. `clarification:request` must broadcast only the caption ID and requester identity; the browser maps it to localized fixed copy.

- [ ] **Step 4: Run focused room tests**

Run:

```bash
pnpm test -- src/server/room/room-registry.test.ts src/server/room/meeting-room.test.ts
pnpm typecheck
```

Expected: PASS. The tests demonstrate the participant cap, secret validation, final-participant cleanup, ordered translation completion, source preservation, and manual-input continuity.

- [ ] **Step 5: Commit room coordination**

```bash
git add dystopia/meeting-translation/src/server/adapters/contracts.ts dystopia/meeting-translation/src/server/room
git commit -s -m "feat(meeting-translation): coordinate ephemeral rooms"
```

### Task 3: Amazon Transcribe and Bedrock Adapters

**Files:**
- Create: `dystopia/meeting-translation/src/server/adapters/bedrock-translator.ts`
- Create: `dystopia/meeting-translation/src/server/adapters/bedrock-translator.test.ts`
- Create: `dystopia/meeting-translation/src/server/adapters/transcribe-recognizer.ts`
- Create: `dystopia/meeting-translation/src/server/adapters/transcribe-recognizer.test.ts`

**Interfaces:**
- Consumes `Translator`, `SpeechRecognizer`, `RecognitionSession`, and `TranslationRequest` from Task 2.
- Produces `BedrockTranslator` and `TranscribeRecognizer`, injected into `RoomRegistry` by Task 4.
- `BedrockTranslator` consumes `ServiceConfig.bedrockModelId`, `ServiceConfig.awsRegion`, and `ServiceConfig.glossary` from Task 1.

- [ ] **Step 1: Write failing Bedrock translator tests**

Inject an object with a mocked `send` method instead of calling AWS. Assert that the translator uses `ConverseCommand`, includes the source text, declared source/target languages, all and only the supplied context captions, and the configured glossary. Assert that it extracts the first text block and rejects an empty or non-text response.

```ts
await expect(translator.translate({
  sourceText: "金曜日の午後3時です。",
  sourceLanguage: "ja-JP",
  targetLanguage: "en-US",
  context: [],
  glossary: ["Panicboat"],
})).resolves.toBe("It is Friday at 3 PM.");

expect(send).toHaveBeenCalledWith(expect.objectContaining({
  input: expect.objectContaining({ modelId: "amazon.nova-lite-v1:0" }),
}));
```

Expected: FAIL because `BedrockTranslator` does not exist.

- [ ] **Step 2: Implement deterministic contextual translation with Bedrock Converse**

Construct a `ConverseCommand` with `modelId` from configuration, a system instruction that requires translation only, preserves names/numbers/dates/negation, and uses supplied glossary entries without inventing facts. Put the source text and a bounded list of prior `{speaker, sourceLanguage, sourceText, translatedText}` values in the user message. Set `temperature: 0` and `maxTokens: 512` in `inferenceConfig`.

Use this shape to isolate the AWS SDK from the room layer:

```ts
export class BedrockTranslator implements Translator {
  constructor(
    private readonly client: Pick<BedrockRuntimeClient, "send">,
    private readonly config: Pick<ServiceConfig, "awsRegion" | "bedrockModelId" | "glossary">,
  ) {}

  async translate(request: TranslationRequest): Promise<string> {
    const response = await this.client.send(new ConverseCommand(/* request */));
    const text = response.output?.message?.content?.find((part) => part.text)?.text?.trim();
    if (!text) throw new Error("Bedrock returned no translation text");
    return text;
  }
}
```

Do not use `ConverseStreamCommand`: a complete source sentence is intentionally translated as one final caption, so a single `ConverseCommand` keeps event completion and error semantics simple.

- [ ] **Step 3: Write failing Transcribe streaming tests**

Build an async iterable of PCM chunks and a mocked `TranscribeStreamingClient.send` result containing one partial and one final `TranscriptEvent`. Verify the adapter starts a separate client per recognition session with this request contract:

```ts
new StartStreamTranscriptionCommand({
  LanguageCode: "ja-JP",
  MediaEncoding: "pcm",
  MediaSampleRateHertz: 16_000,
  EnablePartialResultsStabilization: true,
  PartialResultsStability: "low",
  AudioStream: expect.anything(),
});
```

Assert partial text invokes `onPartial`, final text invokes `onFinal`, `stop` closes the async audio queue and aborts the request, and a `LimitExceededException` becomes the stable `recognition_unavailable` status without leaking AWS error text to a participant.

Expected: FAIL because `TranscribeRecognizer` does not exist.

- [ ] **Step 4: Implement a cancellable per-participant Transcribe session**

Implement an internal `AsyncAudioQueue` whose `push` method accepts `Uint8Array`, whose async iterator yields `{ AudioEvent: { AudioChunk } }`, and whose `close` method ends iteration. `TranscribeRecognizer.start` must allocate its `TranscribeStreamingClient` inside the method so every active participant owns one streaming connection. Pass an `AbortController.signal` to `client.send` and, in `RecognitionSession.stop`, close the queue, abort the request, await its result loop, and call `client.destroy()`.

For every `TranscriptEvent`, read the first alternative. Route `IsPartial === true` to `onPartial`; route a non-empty final transcript to `onFinal`. Handle only `429` and `503` provider errors as reconnectable recognition failures; emit the stable status code and let the browser-triggered audio restart create a new stream. Do not create a second stream on the same client.

- [ ] **Step 5: Run adapter tests and type-check**

Run:

```bash
pnpm test -- src/server/adapters/bedrock-translator.test.ts src/server/adapters/transcribe-recognizer.test.ts
pnpm typecheck
```

Expected: PASS. The tests prove finalized speech is the only input to the translator, names/numbers are explicitly protected by the prompt, and each microphone stream has a clear stop owner.

- [ ] **Step 6: Commit AWS adapters**

```bash
git add dystopia/meeting-translation/src/server/adapters
git commit -s -m "feat(meeting-translation): add AWS speech adapters"
```

### Task 4: HTTP, WebSocket, and Lifecycle Transport

**Files:**
- Create: `dystopia/meeting-translation/src/server/transport/websocket-route.ts`
- Create: `dystopia/meeting-translation/src/server/app.ts`
- Create: `dystopia/meeting-translation/src/server/main.ts`
- Test: `dystopia/meeting-translation/src/server/app.test.ts`
- Test: `dystopia/meeting-translation/src/server/transport/websocket-route.test.ts`

**Interfaces:**
- Consumes `RoomRegistry` from Task 2 and concrete AWS adapters from Task 3.
- Produces `createApp(dependencies: AppDependencies): FastifyInstance` and `startServer(): Promise<void>`.
- Exposes `POST /translate/api/rooms`, `GET /translate/healthz`, `GET /translate/ws`, `GET /translate/`, and `GET /translate/rooms/:roomId`.

```ts
export interface AppDependencies {
  config: ServiceConfig;
  registry: RoomRegistry;
  publicDir: string;
}
```

- [ ] **Step 1: Write failing HTTP and WebSocket transport tests**

Use Fastify injection for HTTP and `injectWS` for WebSocket. Test these externally observable outcomes:

```ts
const created = await app.inject({ method: "POST", url: "/translate/api/rooms" });
expect(created.statusCode).toBe(201);
expect(created.json()).toEqual({
  roomId: expect.any(String),
  joinToken: expect.any(String),
});

const socket = await app.injectWS("/translate/ws");
socket.send(JSON.stringify(validJoin));
await expect(nextMessage(socket)).resolves.toMatchObject({ type: "room:joined" });
```

Add cases for the sixth room creation in the rate window returning `429`, invalid JSON producing `invalid_message`, audio binary before `audio:start` being rejected, a binary PCM frame after start reaching the fake recognizer, and `socket.close()` stopping its recognition session and eventually deleting an empty room.

Expected: FAIL because `createApp` and the WebSocket route do not exist.

- [ ] **Step 2: Implement the app factory and static delivery**

Register `@fastify/websocket` before every HTTP and static route. Configure a 64 KiB WebSocket `maxPayload`, a structured logger that emits only event codes and IDs, and a custom WebSocket error handler that does not log message bodies, audio, token values, or transcripts.

Create `POST /translate/api/rooms` to call `RoomCreationLimiter` and `RoomRegistry.create`. Return only `{ roomId, joinToken }`; the browser creates the link with `window.location.origin + "/translate/rooms/" + roomId + "#" + joinToken`, so the token never appears in an HTTP request URL. Create `GET /translate/healthz` returning `{ status: "ok" }`.

Serve Vite's `dist/public` with `@fastify/static`. Set immutable caching only for hashed `/translate/assets/*` files. Route `/translate/` and `/translate/rooms/:roomId` to `index.html` with `Cache-Control: no-store` so a closed or refreshed tab never receives an old HTML response containing participant state.

- [ ] **Step 3: Implement the synchronous WebSocket route and shutdown ownership**

Attach `message`, `close`, and `error` handlers synchronously in the `wsHandler`, before awaiting room join work. This follows `@fastify/websocket`'s requirement and prevents an initial join frame from being dropped. Accept JSON text frames through `parseClientMessage`; accept binary frames only after the connection owns an active recognition session; reject all other frames with a stable status event.

Wire each joined participant to a `RoomConnection` whose `send` method checks `socket.readyState === socket.OPEN` before serializing `ServerMessage`. On close, call `registry.disconnect(participantId)` exactly once. The process signal handler must stop new connections with `app.close()`, call `registry.destroyAll()`, then exit only after active Transcribe streams have stopped:

```ts
const shutdown = async () => {
  await app.close();
  await registry.destroyAll();
};

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
```

If a socket has already closed while sending its final status, ignore only that expected write failure with an English `// SILENT:` explanation; do not suppress provider or protocol failures.

- [ ] **Step 4: Run transport tests and production type-check**

Run:

```bash
pnpm test -- src/server/app.test.ts src/server/transport/websocket-route.test.ts
pnpm typecheck
```

Expected: PASS. The test suite proves that the token stays out of the HTTP route, protocol handlers are installed before async work, audio has one session owner, and disconnect cleanup is deterministic.

- [ ] **Step 5: Commit the transport layer**

```bash
git add dystopia/meeting-translation/src/server/app.ts dystopia/meeting-translation/src/server/app.test.ts dystopia/meeting-translation/src/server/main.ts dystopia/meeting-translation/src/server/transport
git commit -s -m "feat(meeting-translation): serve realtime meetings"
```

### Task 5: Browser Meeting Experience and PCM Capture

**Files:**
- Create: `dystopia/meeting-translation/src/web/index.html`
- Create: `dystopia/meeting-translation/src/web/main.tsx`
- Create: `dystopia/meeting-translation/src/web/app.tsx`
- Create: `dystopia/meeting-translation/src/web/styles.css`
- Create: `dystopia/meeting-translation/src/web/lib/caption-display.ts`
- Create: `dystopia/meeting-translation/src/web/lib/caption-display.test.ts`
- Create: `dystopia/meeting-translation/src/web/lib/pcm.ts`
- Create: `dystopia/meeting-translation/src/web/lib/pcm.test.ts`
- Create: `dystopia/meeting-translation/src/web/lib/room-link.ts`
- Create: `dystopia/meeting-translation/src/web/lib/room-link.test.ts`
- Create: `dystopia/meeting-translation/src/web/hooks/use-meeting-socket.ts`
- Create: `dystopia/meeting-translation/src/web/hooks/use-microphone.ts`
- Create: `dystopia/meeting-translation/src/web/audio/pcm-processor.ts`
- Create: `dystopia/meeting-translation/src/web/components/entry-form.tsx`
- Create: `dystopia/meeting-translation/src/web/components/meeting-view.tsx`
- Create: `dystopia/meeting-translation/src/web/components/caption-list.tsx`
- Create: `dystopia/meeting-translation/src/web/components/manual-caption-form.tsx`

**Interfaces:**
- Consumes `Caption`, `Participant`, `ClientMessage`, and `ServerMessage` from Task 1.
- Consumes the HTTP and WebSocket endpoints from Task 4.
- Produces browser-only `useMeetingSocket`, `useMicrophone`, `toPcm16`, and `createRoomLink` APIs. It never imports an AWS SDK or server configuration module.

- [ ] **Step 1: Write failing pure browser helper tests**

Cover display language choice, binary conversion, and token fragment creation without needing a real microphone:

```ts
expect(primaryCaptionText({
  sourceLanguage: "en-US",
  sourceText: "The deadline is Friday.",
  translatedText: "締め切りは金曜日です。",
} as Caption, "ja")).toBe("締め切りは金曜日です。");

expect([...toPcm16(new Float32Array([-1, 0, 1]))]).toEqual([
  0x00, 0x80, 0x00, 0x00, 0xff, 0x7f,
]);

expect(createRoomLink("https://dystopia.city", "room_123", "token_123")).toBe(
  "https://dystopia.city/translate/rooms/room_123#token_123",
);
```

Expected: FAIL because the browser helper modules do not exist.

- [ ] **Step 2: Implement the meeting state hook and localized UI**

`useMeetingSocket` must construct the WebSocket URL from the current origin and `/translate/ws`, send the validated join message, and retain room state only in React state. Use reconnection delays `[250, 500, 1000, 2000, 4000]` milliseconds for network-close codes; after the final failed attempt, show a localized manual reconnect action. Do not use `localStorage`, cookies, or browser persistence for captions or tokens.

`EntryForm` must collect display name, speech language, display language, and explicit consent before enabling join. Its create action calls `POST /translate/api/rooms`, constructs the fragment link with `createRoomLink`, copies it with `navigator.clipboard.writeText`, and always renders a selectable link as a non-clipboard fallback. `App` reads the room ID from `/translate/rooms/:roomId` and the token only from `location.hash.slice(1)`.

`MeetingView` must show participant names, microphone state, reconnect state, a chronological caption list, and a manual caption form. `CaptionList` renders the configured display language first and has an accessible disclosure for the source text and translation. A confirmation button sends `clarification:request`; all participants render fixed Japanese or English copy from the event's IDs rather than asking Bedrock to translate UI controls.

- [ ] **Step 3: Implement AudioWorklet PCM capture and lifecycle cleanup**

Use `navigator.mediaDevices.getUserMedia({ audio: true })` only after the participant presses the microphone control. Load `pcm-processor.ts` with `audioContext.audioWorklet.addModule`. The processor must mix input channels to mono, resample its input `sampleRate` to 16,000 Hz, buffer 320 samples (20 ms), and post each `Float32Array` frame back to the main thread. `toPcm16` converts each frame into a little-endian `ArrayBuffer`; `useMeetingSocket` sends that buffer as a binary WebSocket frame after `audio:start`.

`useMicrophone.stop` must send `audio:stop`, disconnect the `AudioWorkletNode`, stop every `MediaStreamTrack`, and close the `AudioContext`. Register the same cleanup for `pagehide` and component unmount:

```ts
// FALLBACK: manual text remains available when getUserMedia is denied or unavailable.
if (!navigator.mediaDevices?.getUserMedia) {
  setStatus("microphone_unavailable");
  return;
}
```

Display a localized microphone permission failure without preventing the user from joining or using the manual caption form.

- [ ] **Step 4: Run browser helper tests, full tests, and the production build**

Run:

```bash
pnpm test -- src/web/lib/caption-display.test.ts src/web/lib/pcm.test.ts src/web/lib/room-link.test.ts
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS. `dist/public` contains the Web UI and `dist/server/main.js` starts the same-origin service without exposing an AWS package to browser code.

- [ ] **Step 5: Commit the browser application**

```bash
git add dystopia/meeting-translation/src/web
git commit -s -m "feat(meeting-translation): add live caption interface"
```

### Task 6: Container, AWS Permissions, Kubernetes, Flux, and Release Registration

**Files:**
- Create: `dystopia/meeting-translation/Dockerfile`
- Create: `dystopia/meeting-translation/.dockerignore`
- Create: `dystopia/meeting-translation/kubernetes/base/configmap.yaml`
- Create: `dystopia/meeting-translation/kubernetes/base/deployment.yaml`
- Create: `dystopia/meeting-translation/kubernetes/base/service.yaml`
- Create: `dystopia/meeting-translation/kubernetes/base/serviceaccount.yaml`
- Create: `dystopia/meeting-translation/kubernetes/base/httproute.yaml`
- Create: `dystopia/meeting-translation/kubernetes/base/kustomization.yaml`
- Create: `dystopia/meeting-translation/kubernetes/overlays/production/deployment.yaml`
- Create: `dystopia/meeting-translation/kubernetes/overlays/production/kustomization.yaml`
- Modify: `dystopia/infrastructure/aws/modules/pod_identity.tf`
- Modify: `clusters/production/dystopia/kustomization.yaml`
- Create: `clusters/production/dystopia/meeting-translation/kustomization.yaml`
- Create: `clusters/production/dystopia/meeting-translation/service.yaml`
- Create: `clusters/production/dystopia/meeting-translation/image-repository.yaml`
- Create: `clusters/production/dystopia/meeting-translation/image-policy.yaml`
- Create: `clusters/production/dystopia/meeting-translation/image-automation.yaml`
- Modify: `release-please-config.json`

**Interfaces:**
- Consumes the service's `pnpm build` and `node dist/server/main.js` scripts from Tasks 1–5.
- Provides a Pod Identity role for `meeting-translation`, an internal Service on port 80 to container port 3000, and a public `dystopia.city/translate` prefix route.
- The container receives `AWS_REGION`, `BEDROCK_MODEL_ID`, `MEETING_BASE_PATH`, and `TRANSLATION_GLOSSARY` only through its ConfigMap.

- [ ] **Step 1: Write the failing manifest and policy checks**

Before creating the manifests, record the commands that must initially fail because their directories and role do not exist:

```bash
kustomize build dystopia/meeting-translation/kubernetes/overlays/production
kustomize build clusters/production/dystopia
terraform -chdir=dystopia/infrastructure/aws/modules fmt -check
```

Expected: the two Kustomize builds fail because the service manifests do not exist; Terraform formatting is unchanged before the policy edit.

- [ ] **Step 2: Build a production container without development dependencies**

Base the Dockerfile on `node:24.20.0-alpine`, matching the existing frontend image. In the builder stage enable Corepack, copy `package.json` and `pnpm-lock.yaml`, run `pnpm install --frozen-lockfile`, copy the source, run `pnpm build`, then run `pnpm prune --prod`. In the runner stage copy only `dist`, production `node_modules`, and `package.json`; create a non-root `nodejs` user; expose port 3000; and run `node dist/server/main.js`.

Create `.dockerignore` to exclude `node_modules`, `dist`, `.git`, `.worktrees`, coverage output, and local environment files. Do not place AWS credentials or a model ID in the image.

- [ ] **Step 3: Add Kubernetes resources and same-host routing**

Create a single-replica Deployment named `meeting-translation` with `serviceAccountName: meeting-translation`, `terminationGracePeriodSeconds: 30`, port 3000, and `GET /translate/healthz` liveness/readiness probes. `replicas: 1` is required because room state is intentionally process-local. The Service exposes port 80 to target port 3000.

Create an `HTTPRoute` on `cilium-gateway` for hostname `dystopia.city` and `PathPrefix` `/translate`, pointing to the new Service. This more-specific prefix coexists with the existing `/` frontend route and preserves one public origin for the fragment-based meeting links and WebSocket upgrades.

Set the base ConfigMap values to:

```yaml
data:
  AWS_REGION: ap-northeast-1
  BEDROCK_MODEL_ID: amazon.nova-lite-v1:0
  MEETING_BASE_PATH: /translate
  TRANSLATION_GLOSSARY: ""
```

`amazon.nova-lite-v1:0` is selected because the Bedrock model card documents `Converse` support and in-region availability in `ap-northeast-1`; the service keeps this as configuration rather than embedding it in translation code. Add a production image patch using `ghcr.io/panicboat/monorepo/meeting-translation:v0.1.0` and the existing Flux image-policy comment pattern.

- [ ] **Step 4: Add least-privilege Pod Identity resources**

In `dystopia/infrastructure/aws/modules/pod_identity.tf`, add an IAM role and EKS Pod Identity association for service account `meeting-translation` in namespace `dystopia`, following the existing monolith role pattern. Attach one policy with exactly these statements:

```hcl
Statement = [
  {
    Effect   = "Allow"
    Action   = ["transcribe:StartStreamTranscription"]
    Resource = "*"
  },
  {
    Effect   = "Allow"
    Action   = ["bedrock:InvokeModel"]
    Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.nova-lite-v1:0"
  },
]
```

The application uses `ConverseCommand`; Bedrock authorizes that inference through `bedrock:InvokeModel`. Do not grant database, S3, Cognito, `bedrock:List*`, or generic AWS permissions. Add the ServiceAccount manifest to the service Kustomization.

- [ ] **Step 5: Register GitOps image automation and release versioning**

Add the `meeting-translation` resource to `clusters/production/dystopia/kustomization.yaml`. Mirror the existing frontend's Flux resources with service-specific names, image `ghcr.io/panicboat/monorepo/meeting-translation`, semver ImagePolicy, and image automation path `./dystopia/meeting-translation/kubernetes/overlays/production`.

Register `dystopia/meeting-translation` in `release-please-config.json` with `release-type: "simple"`, `component: "meeting-translation"`, and `include-component-in-tag: true`. This aligns the container tag, Flux policy, and release component.

- [ ] **Step 6: Run container, manifest, and infrastructure verification**

Run:

```bash
pnpm build
docker build -t meeting-translation:local dystopia/meeting-translation
kustomize build dystopia/meeting-translation/kubernetes/overlays/production
kustomize build clusters/production/dystopia
terraform -chdir=dystopia/infrastructure/aws/modules fmt -check
terraform -chdir=dystopia/infrastructure/aws/modules init -backend=false
terraform -chdir=dystopia/infrastructure/aws/modules validate
```

Expected: PASS. The image runs as non-root, all Kustomizations render, and Terraform validates a role that can invoke only the configured speech and translation APIs.

- [ ] **Step 7: Commit deployment integration**

```bash
git add dystopia/meeting-translation/Dockerfile dystopia/meeting-translation/.dockerignore dystopia/meeting-translation/kubernetes dystopia/infrastructure/aws/modules/pod_identity.tf clusters/production/dystopia release-please-config.json
git commit -s -m "feat(meeting-translation): deploy translation service"
```

### Task 7: Service Documentation and Acceptance Verification

**Files:**
- Create: `dystopia/meeting-translation/README.md`

**Interfaces:**
- Consumes the finished local service commands and deployed endpoint from Tasks 1–6.
- Produces operational instructions that state how a meeting is created, which configuration is required, and how to perform the acceptance session without duplicating implementation details from the design spec.

- [ ] **Step 1: Write the documentation acceptance checklist before the final run**

In `README.md`, use English headings and Japanese body text. Include: required AWS model access and Pod Identity apply order; required environment variables; local commands `pnpm install`, `pnpm dev`, `pnpm test`, and `pnpm build`; the fact that each participant opens the shared link and permits their own microphone; and the manual acceptance procedure below.

```text
1. Open one Zoom meeting and three browsers at /translate.
2. Create a room, share the copied fragment link, and join as one Japanese and two English speakers.
3. Start all microphones and speak Japanese and English sentences containing a date, a number, a name, and a negation.
4. Confirm the other-language subtitle appears within the three-second target and expand its source text.
5. Request clarification on one caption and confirm the original speaker receives the localized prompt.
6. Stop one microphone, use manual text translation, then close and rejoin that participant's tab.
7. Confirm the remaining two participants continue receiving captions and the rejoined participant receives only new captions.
8. Close all tabs, reopen the same room URL, and confirm it returns `room_not_found` without replaying a caption.
```

Expected: the checklist is specific enough to run without the design document and does not contain source transcript values or AWS credentials.

- [ ] **Step 2: Execute the full automated verification suite**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
docker build -t meeting-translation:local dystopia/meeting-translation
kustomize build dystopia/meeting-translation/kubernetes/overlays/production
kustomize build clusters/production/dystopia
terraform -chdir=dystopia/infrastructure/aws/modules fmt -check
terraform -chdir=dystopia/infrastructure/aws/modules validate
git diff --check
git status --short
```

Expected: every automated command succeeds and `git status --short` lists only the intended README (and any deliberate design correction).

- [ ] **Step 3: Run the three-person Zoom acceptance session after deployment**

Apply the reviewed Terraform and Kubernetes changes through the repository's existing PR-triggered deployment workflow. Then perform all eight README acceptance steps using the production URL. Record only outcome, elapsed translation time, and error codes in the PR description; do not record spoken content, captions, or join tokens.

Expected: the participants can maintain a bilingual conversation, inspect original text, request clarification, survive one participant's departure, and use manual input when microphone processing is unavailable.

- [ ] **Step 4: Commit documentation and verification instructions**

```bash
git add dystopia/meeting-translation/README.md
git commit -s -m "docs(meeting-translation): add operating guide"
```
