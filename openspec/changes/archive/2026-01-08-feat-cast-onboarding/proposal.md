# Cast Onboarding Wizard

## Summary
新規キャスト向けのマルチステップ形式オンボーディングウィザード（`/manage/onboarding`）を実装します。
このフローでは、キャストプロフィール（基本情報、写真、スケジュール）を「公開可能（Publishable）」な状態にするために必要なデータを収集します。

## Motivation
- **Cast Acquisition**: 新規キャストがプラットフォームに参加する際の障壁を下げ、スムーズな体験を提供するため。
- **Data Completeness**: プロフィール公開前に必要な最低限のデータ（ニックネーム、エリア、写真、スケジュール）を確実に収集するため。

## Design Protocol
### 1. Wizard Structure
- **URL**: `/manage/onboarding`
- **Layout**: 専用の集中型レイアウト（グローバルナビなし、プログレスバーあり）。
- **State Management**: URLベースのルーティング（`/manage/onboarding/step-1` など）を採用。
    - これによりブラウザ履歴への対応やディープリンクが容易になります。

### 2. Steps
1.  **Welcome & Guidelines**: 「Nyxへようこそ」および利用規約/行動規範の確認。
2.  **Basic Identity**:
    - **Business Type (2-Axis)**: 以下の2軸で業態を定義します。
        1. **Service Category (サービスタイプ)**:
            - `Advanced` (本番・濃厚接触 / ソープ)
            - `Standard` (擬似・ソフト / デリヘル・ピンサロ・エステ)
            - `Social` (接触なし・会話 / キャバクラ・デート・チャット)
        2. **Location Type (場所)**:
            - `Store` (店舗型)
            - `Dispatch` (派遣型 / デリバリー)
            - `Hotel` (ホテル待機型)
    - **External Links**: CityHeaven, X (Twitter), Instagram, TikTok, lit.link, その他URL。
    - その他: ニックネーム（源氏名）、タグライン、自己紹介、エリア（六本木など）。
    - その他: ニックネーム（源氏名）、タグライン、自己紹介、エリア（六本木など）。
3.  **Visuals**: プロフィールアイコン、ポートフォリオギャラリー。
    - **推奨**: ギャラリーには**3枚以上の写真登録**を推奨します。
    - **Note**: カバー写真は別途登録せず、ギャラリーの1枚目を自動的に使用（またはトリミング）してユーザーの負担を減らします。
4.  **Service Plans**: 時給制だけでなく、業態に合わせた柔軟な価格設定（プラン作成）。
    - 例: 「標準コース 60分 10,000円」「指名料 3,000円」「ディナー同伴（1回） 20,000円」など。
    - オンボーディングでは「メインとなるプラン」を少なくとも1つ作成します。
5.  **Initial Schedule**: 初回スケジュールの登録（週単位）。
    - **UX**: 「今週」「翌週」を切り替えられるページネーションを実装し、来週から稼働開始したいユーザーにも対応します。
    - 入力方式は「日付選択 -> 開始/終了時間のドラムロール選択」です。
6.  **Publish**: プロフィールカードのプレビューと「規約に同意して開始（Auto-Approval）」。
    - **Policy**: 運営コスト削減のため、審査なしで即時公開（Post-Moderation）とします。
    - 不適切なコンテンツは通報機能や将来的なAI検知で対応します。

### 3. Technical Strategy
- **Components**: フォーム入力には `src/modules/portfolio/components/cast` を新規作成して再利用可能にします。
- **Persistence**: ステップ間の状態保持は、MVPではローカルストレージ（またはバックエンドへのドラフト保存）を利用します。
- **Mock Data**: 提出処理は初期段階ではモック（コンソールログ出力またはローカル状態更新）とします。

## Alternatives Considered
- **Single Page Form**: モバイルユーザーにとって入力項目が多くなりすぎ、離脱率が高まるため却下。
- **Modal Wizard**: 特定のステップへのリンクやリロード時の復帰が難しいため却下。

## Risks
- **Drop-off**: フォームが長すぎると離脱の原因となるため、入力項目は最低限に絞る必要があります。

## Future Enhancements
- **Service Definition Separation**: 将来的には「サービス内容（Service Definition）」と「料金プラン（Pricing Plan）」を分離し、マスタ管理できるようにする構想があります（例: "Dinner Date" というサービス定義に対し、"60min", "90min" などのプランを紐付ける）。
    - MVPでは複雑さを避けるため、プラン名と価格を直接入力する形式とします。
- **AI Categorization**: 業態やタグ入力をフリーテキストにし、AI（LLM）がバックグラウンドで適切なカテゴリに分類・整理する機能。
    - 運用コストがかかるため、将来的な検討事項とします。
