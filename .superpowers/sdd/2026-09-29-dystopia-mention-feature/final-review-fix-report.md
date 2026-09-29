STATUS: DONE

# Summary

7件の最終レビュー指摘を修正し、各指摘に回帰テストを追加した。実装コミットは次のとおり。

- 40420d60 — fix: close mention feature review gaps

設計仕様 docs/superpowers/specs/2026-09-29-mention-feature-design.md を先に確認し、既存の PostHandler#present_posts、ListComments、AddComment のspec、frontendの createRoot/act/dispatchEvent テストパターンに合わせて変更した。

# Environment

指定された環境を確認した。

    $ ruby -v
    ruby 3.4.5 (2025-07-16 revision 20cda200d3) +PRISM [arm64-darwin24]

    $ bundle check
    The Gemfile's dependencies are satisfied

    $ node -v
    v26.1.0

    $ pnpm -v
    12.6.0

# Findings

## C-1: ListPostsByIds mention username resolution

ListPostsByIds に既存のpost handlerと同じaccount IDからusernameを作るlocal helperを追加し、PostPresenter.to_post_protoへ渡した。指定パスの既存specはこのworktreeには存在しなかったため、同じdatabase setupで list_posts_by_ids_spec.rb を作成した。

回帰テストは、実在profileへのmentionをpost relationとして保存し、hydrated protoの mentions.first.username を検証する。

検証レベル: VERIFIED

    $ bundle exec rspec spec/slices/post/use_cases/posts/list_posts_by_ids_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/post/use_cases/extract_mentions_spec.rb spec/slices/post/use_cases/comments/list_replies_spec.rb
    32 examples, 0 failures

## C-2: AddComment mention position after normalization

入力を normalized_content = content.to_s.strip に一度だけ正規化し、mention抽出と保存の両方に使用した。ContentTooLongErrorのraw input長チェックは変更していない。

回帰テストは "\\n@mentioned_user hi" を保存し、contentが先頭改行を持たず、mention positionが 0 であることを検証する。

検証レベル: VERIFIED

    $ bundle exec rspec spec/slices/post/use_cases/posts/list_posts_by_ids_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/post/use_cases/extract_mentions_spec.rb spec/slices/post/use_cases/comments/list_replies_spec.rb
    32 examples, 0 failures

## I-1: Unique mention candidate lookups

matchをusernameの小文字表現でunique化したHashへ先に解決し、そのHashを各occurrenceの出力で再利用するよう変更した。出現箇所ごとのmention recordは維持している。

回帰テストは @alice_1 を3回含む入力で find_by_username("alice_1") が1回だけ呼ばれることと、3件のmentionが返ることを検証する。

検証レベル: VERIFIED

    $ bundle exec rspec spec/slices/post/use_cases/posts/list_posts_by_ids_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/post/use_cases/extract_mentions_spec.rb spec/slices/post/use_cases/comments/list_replies_spec.rb
    32 examples, 0 failures

## I-2: Mention notification display and navigation

通知proto enumへ NOTIFICATION_TYPE_MENTION = 6 を追加し、Ruby handlerのtype mapping、frontendの日本語表示、post遷移を実装した。mentionはcomment/replyと同じく targetPostId を使用する。

proto生成は次の既存コマンドで実行した。

    $ bundle exec ruby bin/codegen
    🚀 Running buf generate...
    🔍 Found grpc plugin in: /Users/takanokenichi/.rbenv/versions/3.4.5/lib/ruby/gems/3.4.0/gems/grpc-tools-1.84.0/bin/x86_64-macos
    ✅ Done.

    $ pnpm proto:gen
    $ buf generate ../../proto/dystopia
    ... ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.

frontend回帰テストはmention専用の説明文と /posts/{targetPostId} を検証する。通知handlerの type_to_enum 専用specは既存の dystopia/monolith/spec/slices/notifications に存在しなかったため、指示どおり新規specは作成していない。

検証レベル: VERIFIED

    $ pnpm exec vitest run src/modules/notifications/lib/format.test.ts src/modules/post/lib/mention-text.test.tsx
    Test Files  2 passed (2)
    Tests       15 passed (15)

## I-3: Email address mention boundary

MENTION_PATTERN に (?<![A-Za-z0-9_@]) の左境界を追加し、email address中の @username を候補にしないようにした。

回帰テストは解決可能な alice_1 を me@alice_1.com に埋め込んだ入力が空配列になることを検証した。既存の開始位置・空白後の正規mentionテストも同じspec実行で通過している。

検証レベル: VERIFIED

    $ bundle exec rspec spec/slices/post/use_cases/posts/list_posts_by_ids_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/post/use_cases/extract_mentions_spec.rb spec/slices/post/use_cases/comments/list_replies_spec.rb
    32 examples, 0 failures

## I-4: MentionText keyboard activation

mention遷移をlocal functionへまとめ、clickとEnter/Spaceのkeydownから共通利用するようにした。Enterでrouter pushされる実DOMテストを追加した。

検証レベル: VERIFIED

    $ pnpm exec vitest run src/modules/notifications/lib/format.test.ts src/modules/post/lib/mention-text.test.tsx
    Test Files  2 passed (2)
    Tests       15 passed (15)

## I-5: Reply-specific mention coverage

既存の add_comment_spec.rb にreplyのmention保存とmention通知のテストを追加した。既存の list_replies_spec.rb にreplyの mentioned_usernames 解決テストを追加した。production codeはこのfindingのためには変更していない。

検証レベル: VERIFIED

    $ bundle exec rspec spec/slices/post/use_cases/posts/list_posts_by_ids_spec.rb spec/slices/post/use_cases/comments/add_comment_spec.rb spec/slices/post/use_cases/extract_mentions_spec.rb spec/slices/post/use_cases/comments/list_replies_spec.rb
    32 examples, 0 failures

# Full Test Suites

## Monolith

検証レベル: VERIFIED

    $ bundle exec rspec
    Finished in 3.3 seconds (files took 1.76 seconds to load)
    484 examples, 0 failures

既存のRuby warningとしてbundlerのcircular require、未使用変数、gRPC method redefinitionなどが出力されたが、終了コードは0でfailureはない。

## Frontend TypeScript

検証レベル: VERIFIED

    $ pnpm exec tsc --noEmit
    終了コード 0（標準出力なし）

## Frontend Vitest

検証レベル: VERIFIED

    $ pnpm vitest run
    Test Files  64 passed (64)
    Tests       205 passed (205)
    Duration    3.37s

Vite configの将来互換warningとNodeのlocalStorage ExperimentalWarningが出力されたが、終了コードは0でfailureはない。

# Self-Review

- C-1のusername解決は指定どおりListPostsByIds内のlocal helperに限定し、既存handlerとの共有リファクタは行っていない。
- C-2ではraw contentの長さ検証を維持し、正規化後の文字列だけを抽出・保存へ渡している。
- I-1ではunique lookupとoccurrenceごとの出力を分離し、重複mentionの位置情報を失っていない。
- I-2ではproto source、Ruby stub、TypeScript stub、handler、formatter、frontend testを同じenum値で確認した。
- I-3ではemail boundaryと既存の開始位置・空白後mentionを同一spec suiteで確認した。
- I-4ではrenderToStaticMarkupではなくhappy-domの実DOMとReact act/keyboard eventを使用した。
- I-5ではreplyの保存・通知とListRepliesのusername解決を別々に検証した。
- production codeに新規コメントは追加していない。既存コメントの変更もない。
- 生成時にfrontendの全stubへ出た無関係な機械的差分は戻し、notification stubだけを保持した。
- git diff --check は通過している。

# Concerns and Open Questions

ブロッカーおよび未解決の実装上の懸念はない。生成ツールの現行版によりnotification TypeScript stubのgenerator headerが protoc-gen-es v2.14.0 から v2.15.0 に更新され、protoコメントの一部が再出力されなかったが、生成結果はTypeScript検査とfrontend全テストを通過している。
