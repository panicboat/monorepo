# Product Direction & MVP Definition — Cast-first SNS

Date: 2026-06-20
Status: Direction spec (master plan). Decomposes into sub-project specs; this doc is NOT a single implementation plan.
Scope: 解決したい課題に対してプロダクトを正しく作り上げるための北極星。法務は本ドキュメントの考慮対象外（プロダクト確立後に落とし込む）。

Supersedes the legal-led framing of the session handoff (`2026-06-18-session-handoff.md` Section 11/12) for product planning purposes.

## Concept

**「キャストに寄り添う SNS」** — 従事者（Cast）の側に立つプラットフォーム。

差別化の軸:
- mainstream SNS（X / Instagram 等）は Cast を運営の独自判断で凍結し、集客基盤を奪う。
- 客向けレビューサイトは客（Guest）に奉仕する。
- 本プロダクトは **Cast を凍結せず、Cast に自己防衛手段を与える**、従事者ファーストの SNS。

## 中核課題（2 柱・両方が MVP 必須）

ユーザー定義（原文の要約）:

1. **集客力の安定** — 既存プラットフォームの「運営の独自判断によるアカウント凍結」で Cast の集客が不安定になる。これを解消する、凍結されない・予測可能な集客チャネル。
2. **問題のある Guest からの自己防衛** — Cast が悪質な客から身を守る仕組み。

両柱が揃って初めて「キャストに寄り添う」が成立する。どちらか欠けると MVP として不十分（ユーザー合意済）。

## MVP スコープ

### 柱 A — 安定した集客の場（durable presence）

| 項目 | MVP | 備考 |
|---|---|---|
| Real Login / Signup | ✅ 必須（再建） | 現状は dev-only の authStore 直注入のみで、本番ログインは解体済 |
| Onboarding（Cast / Guest 別） | ✅ 必須 | Cast は業種選択 + プロフィール作成等、Guest は簡易 |
| **凍結しない（永久 BAN 機構を持たない）** | ✅ 必須（**絶対**） | mainstream との決定的差別化。プラットフォームに永久アカウント停止の機構を設けない |
| アカウント / オーディエンスの永続性 | ✅ 必須 | followers / profile / 投稿 / 履歴は Cast の資産。運営が消さない |
| オーディエンス / データのエクスポート（携帯性） | ❌ MVP 外 | 「凍結しない」自体が顧客を失わない保証を満たすため、export は将来検討に降格（`docs/superpowers/specs/2026-06-29-account-durability-design.md` で判断） |
| reach / discovery（feed / ranking / search / おすすめ） | ✅ 実装済 | 既存 engagement 層 |
| 一時ペナルティ（一定期間の制限） | ❌ MVP 外 | 将来の運用。永久 BAN の代替として時限的措置を設計するが MVP では不要 |

### 柱 B — 自己防衛

| 項目 | MVP | 備考 |
|---|---|---|
| **karte**（Cast 間の Guest 評価共有） | ✅ 必須（新規） | 自己防衛の核 & 将来の主収益源。**詳細設計は別 spec**（規模・論点が大きい） |
| block（双方向） | ✅ 実装済 | social slice |
| footprints（足跡 / 訪問可視化 + opt-out） | ✅ 実装済 | footprints slice |
| 通報 / abuse 報告フロー | ⚠ 要確認 | 自己防衛として最低限の通報導線が要るか、karte spec で扱うか別途判断 |

## 収益化（商業）

- **MVP では課金結合なし**。まず Cast の定着と 2-sided liquidity（安定集客 + 自己防衛）を無料で作る。
- ただし **karte の data モデル / 権限境界を、将来 paywall を軽く足せる形に設計**する（karte 有料化 / 投げ銭 / サブスク等を後から結合可能に）。

## 本ドキュメントのスコープ外（別トラック）

- **法務** — プロダクトを正しく作り上げた後に落とし込む。特に「凍結しない」「karte」は本来法務が締めにくる領域だが、本計画では product 設計を先行させる。
- **一時ペナルティ** — 将来の運用モデル。
- **課金実装** — 設計のみ含める（上記）。
- **運用インフラ**（本番 deploy pipeline / 本番 DB / 監視 / secrets / CDN 等）— release には必須だが product 確立後の別トラック。

## 分解（sub-projects）

本ドキュメントは方向を定める。各 sub-project はそれぞれ spec → plan → 実装サイクルを持つ。

| # | sub-project | 状態 | 備考 |
|---|---|---|---|
| 1 | Auth / Onboarding 再建 | 未着手 | well-understood・標準。real Login/Signup + Cast/Guest onboarding |
| 2 | karte（Guest 評価共有） | 未着手 | 最大の未知。独立 brainstorm/spec が必要（記録項目・共有範囲・Cast 間可視性・濫用防止・将来 paywall 境界） |
| 3 | Account durability + self deactivation | ✅ 完了予定（本 PR） | 凍結しない方針の product 化 + 本人退会（2-stage soft → hard）。export は MVP 外。`docs/superpowers/specs/2026-06-29-account-durability-design.md` |
| — | engagement 層（feed/profile/social/discovery/messaging/footprints/notifications/bookmarks） | ✅ 完了 | 既存実装 |

## 推奨ビルド順

**1. Auth/Onboarding 再建 → 2. karte → 3. durability/export**

理由:
- karte は Guest を identity に紐づけて評価を蓄積するため、**real な identity 基盤**を前提とする。auth 再建が karte を含む全実 dogfooding を unblock する。
- auth/onboarding は標準で確実に着地でき、最初の足場になる。
- karte は設計の深掘り（独立 brainstorm）が要るので、基盤を固めてから着手する。
- durability/export は方針（凍結しない）と整合する形で auth 基盤の上に乗せる。

## 次アクション

この direction 確定後、**sub-project #1「Auth/Onboarding 再建」の brainstorming** に進む（本 direction doc 自体は単一実装計画に落ちないため writing-plans へは直行しない）。

## 成功基準（MVP）

- Cast が real account を作成・onboarding し、凍結の恐れなく集客に使える。
- Cast が自分の意思で退会でき、30 日以内なら復活できる（**export は MVP 外に降格**、`docs/superpowers/specs/2026-06-29-account-durability-design.md` 参照）。
- Cast が karte で問題のある Guest を Cast 間共有し、自己防衛できる。
- 永久 BAN 機構が存在しない。
- karte の data/権限設計が将来の課金結合を阻害しない。
