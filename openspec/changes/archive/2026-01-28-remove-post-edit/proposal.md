# Change: Remove Post Edit Feature

## Why

Timeline のポスト編集機能を一時的に無効化する。現時点では投稿の作成と削除に集中し、編集機能は将来のフェーズで再導入を検討する。フロントエンド UI 上にも編集ボタンは未実装であり、バックエンドの SaveCastPost API の更新機能（id 指定時の update）はそのまま残すが、仕様としてはスコープ外とする。

## What Changes

- Timeline spec から「キャストが投稿を編集する」シナリオを削除
- Timeline API spec から「既存投稿の保存」シナリオを削除
- バックエンド API の update 機能自体は技術的に残存するが、仕様上は未サポートとして扱う

## Impact

- Affected specs: timeline
- Affected code: 仕様変更のみ。コード変更は不要（UI に編集ボタンが存在しないため）
