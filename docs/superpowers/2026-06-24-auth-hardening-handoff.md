# Session Handoff: Auth Hardening sub-project (2026-06-24)

▎ 新セッションがこの作業を正確に引き継ぐための単一情報源。まずこれを読む。
▎ 前セッションでツール呼び出しの発行ミスが頻発し信頼を損ねたため引き継ぎ。技術的な作業状態は以下に正確に残す。

0. 最重要・未解決の論点（次セッションが最初に解くべき）

ユーザの最後の問い（未回答）:

▎ 「client JS が accessToken を読んで毎リクエストに Authorization: Bearer を付け BFF が gRPC へ転送する仕組みも最適化したい。CiliumEnvoyConfig 前提の仕組みになってるんでしたっけ？」

これは auth hardening spec の cookie/BFF 仲介の意思決定を覆しうる重大論点。前セッションで以下を発見したが未読・未反映:
- docs/分散システム設計/ に AUTHENTICATION.md / AUTHORIZATION.md / JWT_SECURITY.md が存在（前任は未読のまま spec を書いた）。
- 別 worktree feat-k3d-local-env で k3d + Cilium/Envoy + Gateway API (HTTPRoute) の構築が並行進行（specs/plans 2026-06-23/24、services/frontend/kubernetes/base/httproute.yaml 等）。
- authentication_interceptor.rb:36 に # Case 1: Gateway Offloading (Future / Cilium) で x-user-id 無検証信頼の経路あり。ユーザは「ゲートウェイ導入は確定」と明言済。

→ 次セッションの初手: 上記 3 つ（分散システム設計の auth 3 docs + k3d worktree の spec + interceptor）を必ず読み、「本番の認証アーキテクチャ（Cilium/Envoy が JWT を offload し x-user-id を付与、gRPC は x-user-id を信頼）」を把握した上で、auth-hardening spec の token 保管/BFF 仲介の設計を整合させること。 cookie+BFF 仲介がゲートウェイ前提と矛盾/重複しないか要検証。場合によっては hardening spec の Section C を作り直す。

1. 全体の現在地（コンパクト版）

プロダクト = Cast ファースト SNS（風俗業界）。中核課題 2 柱: A. 集客力の安定（凍結しない durable presence + audience export）/ B. 問題のある Guest からの自己防衛（karte）。法務は考慮対象外（プロダクト確立後に落とし込む）。
- 北極星: docs/superpowers/specs/2026-06-20-product-direction-mvp-design.md（PR #760, merged）。
- ビルド順: ① Auth/Onboarding ✅（#761 merged）→ ② karte → ③ durability/export。
- 走っている session handoff: docs/superpowers/2026-06-18-session-handoff.md（随時更新してきた本体）。

直近 merged（このセッション群の成果）

#750 post-card next/image / #751 notif spec / #752 desktop nav / #753 SuggestUsers / #754 footprints visit count / #755 protoc-gen-es pin / #756 cast online dead-code 削除+offer.schedules drop / #757 brand mark / #758 theme switcher / #759 portfolio→profile schema rename / #760 product direction / #761 Auth/Onboarding 再建（sub-project #1）。すべて origin/main 反映済（local main = 3f6ba375）。

2. いま作業中のもの: Auth Hardening sub-project（spec 段階・実装未着手）

PR #761（auth 再建）の最終 review + 専用 security audit で見つかった「現状 main で生きている auth 脆弱性」を一括で潰す sub-project。brainstorming → spec 執筆まで完了、writing-plans/実装は未着手。

成果物の所在（ローカルのみ・未 push）

- worktree: .claude/worktrees/feat-auth-hardening
- branch: feat/auth-hardening（base = origin/main 3f6ba375 = #761）
- commits:
  - 6bc13ed9 docs: auth hardening design spec（初版）
  - 0d077af7 docs: full BFF token-mediation（access+refresh とも cookie 化に改訂）
- spec 本体: docs/superpowers/specs/2026-06-23-auth-hardening-design.md
- 未 push / PR 未作成。 次セッションは worktree をそのまま使うか、push して Draft PR 化する。

audit の結論（#761 で既に解消＝対象外）

0000 ハードコード / SMS mock / reset_password 不在 / 4 桁コード → すべて #761 で解消済。（audit は #761 前の古い local main で走ったため初版に混入していたが、reconcile 済。）

spec で確定した brainstorming 意思決定（重要・失わないこと）

1. hardening を karte より先に実施。
2. スコープ = 現状 main で生きている findings 全部を 1 sub-project（複数 PR）。
3. rate-limiting 保存先 = DB（PostgreSQL）。Redis 不採用（新インフラ前倒し回避、ops トラックに残す）。rate-limiter は 1 モジュールに閉じ将来 Redis 移行を局所化。
4. token 保管 = access+refresh とも httpOnly cookie / client JS 非保持 / BFF 仲介（full token-mediation）。CSRF = SameSite=Lax + 全 mutation 非 GET。← この決定は §0 のゲートウェイ整合で再検討が必要。
5. #2 x-user-id なりすまし = アプリ対応なし、運用トラックに 2 要件記録（ゲートウェイが client の x-user-id を strip / gRPC をゲートウェイ以外から到達不能に）。← §0 と直結。
6. 既定値: コード試行 5 / ログイン試行 5・ロック 15 分 / SMS 送信 60秒1・日5 / refresh TTL 60→30 日。
7. password 最小長 4→8、BCrypt cost 明示(12)、timing-safe 比較、register の account enumeration 抑止。

spec の Decomposition（H1〜H9）

- H1 sms_verifications migration（consumed_at + failed_attempts）+ relation
- H2 VerifyCode: timing-safe 比較 + 試行回数制限（TDD）
- H3 Register/ResetPassword: token 単回使用（consumed_at）（TDD）
- H4 SendCode: SMS 送信 rate limit + 旧コード無効化（TDD）
- H5 users migration（failed_login_attempts + locked_until）+ relation
- H6 Login: brute-force lockout（TDD）+ Register enumeration 抑止 + password 最小長 8 + BCrypt cost
- H7 refresh_tokens migration（token→token_digest）+ repo ハッシュ化 + TTL 30 日（TDD）
- H8a BFF token-mediation（cookie set/read + UNAUTHENTICATED 時 transparent refresh-retry）
- H8b client トークン非保持化（authStore identity-only / Authorization 付与撤去 / lib/auth/tokens.ts localStorage 撤去 / AppShell 未認証判定）
- H9 小修正（logout always-revoke / console.error PII）+ handoff doc 更新

注意: H8a/H8b と #2 は §0 の結論次第で変わる。先に §0 を解決してから writing-plans に進むこと。

3. grounding 済みの技術事実（auth slice、再調査の手間を省くため）

- identity slice 完成（Register/Login/Logout/RefreshToken/SendSms/VerifySms/ResetPassword/GetCurrentAccount）。
- relations: identity__sms_verifications(id, phone_number, code, expires_at, verified_at, created_at) / identity__refresh_tokens(id, user_id, token=平文, expires_at, created_at) / identity__users(id, phone_number, password_digest, role, created_at, updated_at)。
- verification_token = verified 済 sms_verifications 行の id。find_by_id で取得。
- password = BCrypt::Password.create（cost 未明示）。VerifyCodeContract::CODE_LENGTH = 6（#761 で 4→6 済）。
- RefreshTokenRepository: token: で create/find_by_token/revoke。rotation は Token::Refresh で実装済、Logout で server revoke 済。
- frontend: authFetch(src/lib/auth/fetch.ts) と swr fetcher が getAuthToken()(authStore.accessToken) を読み Authorization: Bearer を付与。BFF buildGrpcHeaders(src/lib/request.ts) が Authorization を gRPC へ転送。authStore = Zustand persist（localStorage）。
- JWT = RS256 + 1h TTL + ENV 鍵（OK、変更しない）。
- lib/sms（#761）= SnsAdapter / FakeAdapter（env 選択）。SendCode は 6 桁ランダム生成 + Sms.send。

4. 開発フロー規約（このプロジェクト）

- 実装前に worktree 確認（.claude/worktrees/<branch-dash>、base = origin/main）。
- commit は -s signoff・Co-Authored-By 禁止・英語メッセージ・PR タイトル conventional。
- 一区切りで push→Draft PR（gh pr create --draft）→ gh pr ready → gh pr merge --squash --delete-branch --auto。auto-merge 後は待たず次へ。
- monolith migration 追加時 structure.sql は同梱不要。test migrate 後の pg_dump version mismatch 失敗は無視可。検証は rspec。
- proto 変更は repo-root ./bin/codegen（Ruby+TS）。Gemfile 触ったら bundle install → bundle install --frozen。
- frontend に unit-test harness なし → 検証は tsc --noEmit + pnpm lint(0e/0w) + pnpm build。
- bare find/grep は shadowed → /usr/bin/find /usr/bin/grep。
- subagent-driven 実装時は各タスク後に spec-compliance + code-quality review、最後に holistic review（#761 で本番ブロッカーを捕捉した実績あり＝省略しない）。

5. memory（永続）で特に効かせるもの

- feedback_tool_call_discipline.md — ツール呼び出しは必ず本物の function call で発行。本文に <invoke>/<parameter> を書くと無音失敗。各呼び出し後に結果確認。（前セッションの主要失敗。新セッションは特に厳守）
- feedback_no_negative_legacy.md — 最終成果物に負の遺産を残さない。据え置き理由は実コスト検証。データ損失も許容＝判断軸はクリーンさ。
- feedback_verify_claims_against_code.md / feedback_reference_grounding.md — 主張・参考資料は実物確認してから。
- project_migration_structure_sql.md / feedback_create_draft_prs.md / feedback_auto_merge_no_wait.md / feedback_bundle_freeze_check.md / feedback_verify_by_running_tests.md。

6. 次セッションの推奨手順

1. §0 を解決: docs/分散システム設計/{AUTHENTICATION,AUTHORIZATION,JWT_SECURITY}.md + feat-k3d-local-env worktree の k3d/Gateway spec + authentication_interceptor.rb を読み、本番認証アーキ(Cilium/Envoy gateway offloading)を把握。
2. その上で auth-hardening spec の Section C（token 保管/BFF 仲介）と #2 を整合・必要なら改稿。ゲートウェイが JWT を edge で検証する前提なら、BFF 仲介 cookie 方式の是非・責務分界が変わる可能性大。
3. spec 確定後、ユーザ review → writing-plans → subagent-driven 実装（H1〜H9）。
4. backend hardening（H1〜H7）はゲートウェイ論点と独立に進められる部分が多い（token 単回使用 / rate-limit / refresh ハッシュ / password 強度 等）。token 保管(H8)だけが §0 依存。先に独立部分を進める分割も可。

7. 注意

- feat/auth-hardening は未 push。失わないよう、引き継ぎ後すぐ push して Draft PR 化することを推奨（spec-in-progress でも Draft なら可）。
- feat-k3d-local-env は別作業（おそらく別セッション/担当）。auth アーキの source-of-truth になり得るので衝突に注意。
