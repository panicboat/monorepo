# Frontend Rebuild Roadmap

Date: 2026-05-30
Status: Program roadmap
Scope: rx-sns 由来デザインへの frontend フル再構築の全体工程。各フェーズは個別 spec / plan に展開する。

## Why this document

design system spec（`specs/2026-05-29-design-system-design.md`）はデザイン言語（token / layout / nav / component / role model / カルテ placement）を定義するが、**現行コードからの移行工程**は定義しない。フル再構築は単一 PR では収まらず、依存とゲートを持つ複数フェーズになるため、その全体像と順序・前提を 1 箇所に固定する。

## Decision context

- ゴールは **フル再構築**（既存ライト/role ベースの画面を最終的に置き換える）。再テーマではない。
- 移行は **clean-slate**：token は新システムだけを残し旧 token を削除する。詳細は `specs/2026-05-30-token-migration-strategy-design.md`。
- 各フェーズ完了後もアプリは `pnpm build` が通る（移行中は旧画面の見た目が崩れるのは許容）。フェーズ単位で独立 PR にできる。

## Rebuild principle (code final form)

最終形は **クリーンで保守しやすいコード**。これを全フェーズの大前提とする。

- **破壊先行（destroy-first）**。presentation 層（旧ページ・旧 component・旧 shell）は新規構築の前に**まとめて削除**し、空のキャンバスに作り直す。新旧共存でゴミを残さない（salvage・token 再スキンによる旧構造の温存をしない）。
- **削除後は placeholder で `pnpm build` を green に保つ**。ただしアプリは再構築完了まで**非機能**（機能は最小）。この状態は feature ブランチ上に置き、deployable な区切りまで main にはマージしない。
- **削除予定コードは直さない**。消す対象の小修正（削除 token 参照の付け替え等）は捨て金なので避ける。
- **例外＝データ / ドメイン層**（`src/modules/*` の hooks / lib / api・`useAuth` / authStore・SWR 配線）は、domain / IA spec が新コンセプトのバックエンド契約を決めるまで **破壊保留**。動くデータ配線を契約未定のまま捨てない。データ層と presentation は import 上分離している（hooks/lib/stores → components 参照 0）ため presentation のみ安全に削除できる。
- greenfield ≠ 車輪の再発明。Radix 等のライブラリは活用し、低レベル挙動（a11y 等）は作り直さない。

## Phases

```
Phase 0  Token foundation ......... done (#645)
   │
Phase 1  共通コンポーネント(1a) + 統合 shell(1b) ... 今ここ
   │
Phase 2  Page rebuilds
   │
Phase 3  カルテ機能（評価共有 SNS）
```

### Phase 0 — Token foundation

- 対象: `globals.css` / `layout.tsx`、`config/theme.ts` の削除。
- 内容: spec §3 の token（neutral / brand / functional / semantic / radius / gradient / glow）を hex で `@theme inline` に統一、Noto Sans JP 導入、root font-size 15px 化、旧 token 一掃。
- spec: 既存 §3（hex 修正済）。plan: `plans/2026-05-30-plan-a-design-tokens-foundation.md`。
- 前提: なし。build green を維持。
- サイズ: 小（1 plan）。
- 状態: **完了**（main 反映、PR #645）。

### Phase 1 — 共通コンポーネント (1a) + 統合 shell (1b)

大きいので 2 sub に分解。greenfield 方針（上記 Rebuild principle）で新規構築する。

**1a 共通コンポーネント語彙（先行・非ブロック）**
- 対象: spec §6 の語彙（CTA / input / tab / toggle / user card / post card / avatar）＋ 新アプリに必要な汎用 primitive。
- 方針: 新 token でクリーンに新規構築。旧 `src/components` の role variant 付きコンポーネントは salvage せず、新規が置き換えた分から削除。削除 token 参照の付け替えはしない。
- 前提: Phase 0。

**1b 統合 app shell + nav**
- 対象: `(cast)` / `(guest)` ルートグループ分離の解消 → 単一 shell + 機能トグル（spec §7 / §9）。desktop 3 カラム / mobile bottom-tab + FAB + drawer（spec §4-5）。
- 前提: Phase 0 ＋ 1a ＋ **domain / IA spec**（nav 項目の多くが未実装ルートを指すため、ルートマップ確定が必要）。
- サイズ: 大。

### Phase 2 — Page rebuilds

- 対象: feed (`/`) / 認証 (`/login`, `/register`) / `/search` / `/bookmarks` / `/ranking` / `/settings` / プロフィール (`/u/<handle>`) / 投稿詳細 (`/posts/<id>`)。
- 内容: 各ページを新 shell 上に再構築。
- 前提: Phase 1 ＋ **新コンセプト（風俗業界 SNS）の domain / feature spec**。spec §9 は module 構成（feed / identity / media / portfolio / post / relationship / trust）に踏み込まないため、どの module が必要かを決める brainstorm が未実施。
- サイズ: 最大。

### Phase 3 — カルテ機能（評価共有 SNS）

- 対象: Cast nav への「カルテ」追加、paywall ロック表示、レコード一覧 / 検索 / 詳細 / 記入フォーム（spec §8）。
- 内容: 本プロダクトの差別化・収益化要素。net-new。
- 前提: Phase 1 ＋ **専用 domain / 課金 spec（未作成）** ＋ **弁護士確認（spec §8 法務フラグ、実装の hard gate）**。
- サイズ: 大。

## Cross-cutting (spec §10 deferred)

- **error / warning / info の正式 semantic color**: 未確定。Phase 0 では暗色仮値（TODO）で先行し、確定後に token を差し替える。これらを使う画面は仮値前提。
- **サービスカテゴリ（デリヘル / ソープ / 個人）の domain model**: 別 spec。Phase 2 の前提になり得る。
- **キャスト年齢 / 本人確認**: 自己申告では不十分（spec §8）。セキュリティ重大事項として別途検討。

## Gates

- Phase 2 は domain / feature spec の brainstorm を経るまで実装着手しない。
- Phase 3 は弁護士確認が完了するまで実装着手しない。
