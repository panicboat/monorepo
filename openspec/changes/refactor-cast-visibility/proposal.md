# Change: Cast Visibility Refactoring

## Why

現状の visibility カラム（unregistered/unpublished/published）は、オンボーディング状態と公開設定を混在させており、拡張が困難。
フォロー承認制を導入するにあたり、visibility を public/private の2値に整理し、オンボーディング完了状態は registered_at で管理する。

## What Changes

- **BREAKING**: Cast.visibility の値を `unregistered|unpublished|published` から `public|private` に変更
- Cast テーブルに `registered_at` カラムを追加（オンボーディング完了日時）
- cast_follows テーブルに `status` カラムを追加（pending/approved）
- private キャストへのフォローは承認制に変更
- private キャストには南京錠アイコンを表示（検索結果、プロフィール）

## Impact

- Affected specs: portfolio, timeline
- Affected code: Portfolio slice, Social slice, proto definitions, frontend
- Data migration required: 既存の visibility 値をマイグレーション

## Out of Scope

以下は別 OpenSpec で対応:

- **private キャストの投稿可視性** - フォロワーのみに投稿を表示
- **private キャストのプロフィール詳細可視性** - 非フォロワーに見せる情報の制御（bio、料金プラン、スケジュール等）

現時点では「private でもプロフィール全体は見える（フォローリクエスト送信可能）」としてシンプルに保つ。
