# portfolio Specification

## Purpose
TBD - created by archiving change implement-full-mock. Update Purpose after archive.
## Requirements
### Requirement: Living Portfolio (High Fidelity) (MUST)
キャスト詳細ページは、ユーザーが「会う」ことを決断するために必要な全ての情報（外見、内面、条件、評判）を網羅し、かつ「実存感（Living Status）」を感じさせる構成でなければならない。

#### Scenario: View Hero & Status
- **WHEN** プロフィールを開いたとき
- **THEN** 画面上部にフルスクリーンのポートレートが表示され、「いま、どうしているか（Online/離席中）」や「今日会えるか（Tonight）」のステータスバッジが視認できる。

#### Scenario: View Detailed Specs
- **WHEN** プロフィール詳細セクションを参照したとき
- **THEN** 基本情報（身長、血液型、職業）に加え、スリーサイズ（BWH）、性格タイプ、趣味（My Boom）、チャームポイントなどの詳細スペックが表示される。

#### Scenario: View Media Gallery
- **WHEN** ギャラリータブを選択したとき
- **THEN** キャストがアップロードした写真や動画がグリッドまたはスライダー形式で閲覧できる。

#### Scenario: View Weekly Schedule
- **WHEN** スケジュールセクションを参照したとき
- **THEN** 向こう1週間の出勤予定（開始・終了時間）が可視化され、そこから直接誓約（Pledge）フローへ遷移できる。

#### Scenario: View System & Price Table
- **WHEN** 料金システムセクションを参照したとき
- **THEN** 標準コース料金、延長料金、指名料、オプションサービス（コスプレ等）の料金表が構造化されて表示される。

#### Scenario: View Reviews & Trust
- **WHEN** レビューセクションを参照したとき
- **THEN** ユーザーからの評価スコア（レーダーチャート）と、実際の口コミコメントが一覧表示される。

### Requirement: Cast Image Gallery (MUST)
キャスト詳細ページにおいて、キャストの複数のプロフィール画像をシームレスに閲覧できなければならない (MUST)。

#### Scenario: Swipe Images
- **WHEN** ユーザーがメイン画像を左右にスワイプ（またはドラッグ）したとき
- **THEN** 画像がスライドし、前後の画像に切り替わる。

#### Scenario: View Indicators
- **WHEN** ギャラリーを表示したとき
- **THEN** 現在表示中の画像が全体の何枚目かを示すインジケーター（ドットまたはバー）が表示される。

### Requirement: Social Proof Visualization (MUST)
キャストの人気度を示す指標（フォロワー数、お気に入り数など）をプロフィール上で確認できなければならない (MUST)。

#### Scenario: View Social Counts
- **WHEN** ユーザーがキャスト詳細画面を開いたとき
- **THEN** フォロワー数、お気に入り数、いいね数がわかりやすく表示されている。

