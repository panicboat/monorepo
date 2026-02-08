# Portfolio Spec Delta

## ADDED Requirements

### Requirement: Plan Recommended Flag (MUST)

キャストはプランに「おすすめ」フラグを設定できなければならない (MUST)。おすすめフラグは複数のプランに設定可能だが、UI では1つのみ選択可能とする。

#### Scenario: Set Recommended Flag

- **Given** キャストがプラン編集画面を開いているとき
- **When** 任意のプランの「おすすめ」トグルをオンにすると
- **Then** そのプランに `is_recommended` フラグが設定される
- **And** 他のプランの「おすすめ」フラグは自動的にオフになる

#### Scenario: Unset Recommended Flag

- **Given** おすすめフラグが設定されたプランがあるとき
- **When** そのプランの「おすすめ」トグルをオフにすると
- **Then** そのプランの `is_recommended` フラグが解除される
- **And** どのプランにもおすすめが設定されていない状態になる

#### Scenario: Display Recommended Badge on Guest View

- **Given** おすすめフラグが設定されたプランがあるとき
- **When** ゲストがキャスト詳細ページのプランセクションを閲覧すると
- **Then** おすすめプランに「おすすめ」バッジが表示される
- **And** おすすめプランがリストの最上位に表示される

#### Scenario: No Recommended Plan

- **Given** どのプランにもおすすめフラグが設定されていないとき
- **When** ゲストがキャスト詳細ページのプランセクションを閲覧すると
- **Then** おすすめバッジは表示されない
- **And** プランは価格順（高い順）で表示される

#### Scenario: Plan Data Model

- **Data Models**:
  - `CastPlan` に `is_recommended` (boolean, default: false) フィールドを追加
  - データベース: `portfolio__cast_plans.is_recommended` カラム
