# Tasks

## Phase 1: Guest API & Data Flow
- [ ] 1.1 `/api/guest/casts/[id]` エンドポイントを作成
- [ ] 1.2 `/casts/[id]` ページでプロフィールデータを fetch
- [ ] 1.3 ProfileSpecs, PhotoGallery に実データを props で渡す

## Phase 2: Display All Persisted Fields
- [ ] 2.1 ProfileSpecs に locationType, area, serviceCategory を表示
- [ ] 2.2 ProfileSpecs に socialLinks セクションを追加
- [ ] 2.3 PriceSystem を plans[] から表示するよう修正
- [ ] 2.4 ScheduleCalendar を weeklySchedules[] から表示するよう修正

## Phase 3: Remove Hardcoded Mock Data
- [ ] 3.1 ProfileSpecs のハードコード fallback を削除（occupation, charm point, personality）
- [ ] 3.2 ProfileSpecs の social metrics（followers, favorites, likes）を削除または非表示
- [ ] 3.3 PhotoGallery の MOCK_GALLERIES を削除
- [ ] 3.4 CostAndSchedule のハードコードデータを削除

## Phase 4: Preview Alignment
- [ ] 4.1 ProfilePreviewModal で ProfileSpecs に全フィールドを渡す
- [ ] 4.2 プレビューモーダルに「プレビュー中（未保存）」インジケーターを追加
- [ ] 4.3 Cast 編集ページとゲスト詳細ページで同じデータ構造を使用することを確認

## Phase 5: Testing & Cleanup
- [ ] 5.1 Guest API の動作確認
- [ ] 5.2 プレビューとゲスト表示の一致を確認
- [ ] 5.3 不要な mock データファイルの削除
