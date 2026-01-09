# Design: Profile Details Schema & UI

## Data Schema Extension
`src/modules/portfolio/types.ts` 内の `CastProfile` と `ProfileFormData` を拡張します。

```typescript
export interface ProfileFormData {
  // ... existing fields

  // Physical
  age?: number;
  height?: number;
  bloodType?: "A" | "B" | "O" | "AB" | "Unknown";
  threeSizes?: {
    b: number;
    w: number;
    h: number;
    cup: string;
  };

  // Attributes
  tags: string[]; // List of tag labels
}
```

## UI Layout
画面の乱雑さを避けるため、`ProfileEditPage` 内で入力を論理的にグループ化します。

```tsx
<div className="space-y-8">
  <Section title="Photos">...</Section>

  <Section title="Basic Info">
    <ProfileInputs /> {/* Nickname, Tagline, Bio, Location */}
    <SocialInputs />
  </Section>

  <Section title="Physical & Measurements"> {/* NEW */}
    <PhysicalInputs />
  </Section>

  <Section title="Character & Appeal"> {/* NEW */}
    <TagSelector />
  </Section>
</div>
```

## Component Specs
### `PhysicalInputs`
- **Height**: 数値入力 (サフィックス "cm")
- **Age**: 数値入力 (サフィックス "歳")
- **Blood Type**: セレクト (A, B, O, AB, ?)
- **Measurements**: B/W/H 入力用のグリッドレイアウト。カップサイズはバストの横にドロップダウンとして配置。

### `TagSelector`
- シンプルなピル形式のセレクタ。
- 入力してフィルタリング/追加が可能 (コンボボックス形式またはシンプル入力+追加ボタン)。
- 提案用に人気のタグを事前定義 (例: "英語OK", "学生", "モデル")。
