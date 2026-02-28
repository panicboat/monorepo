# Bulk Seed Data Design

## Overview

UI/UX検証とデモ/プレゼンテーション用に、大量のシードデータを生成する設計。既存のテストシナリオ用データ（7人）を保持しつつ、成長期のサービスイメージを再現する。

## Approach

**ハイブリッド方式**を採用:
- 重要なデータ（キャスト名・プロフィール）: デモ映えする静的リストから取得
- 関係性・アクティビティ: ランダム生成（確率分布で調整）
- シード値固定で再現性を確保

## Data Volume

| Data Type | Current | Added | Total |
|-----------|---------|-------|-------|
| Casts | 3 | 97 | **100** |
| Guests | 4 | 396 | **400** |
| Posts | 9 | ~15,000 | **~15,000** |
| Follows | 4 | ~4,000 | **~4,000** |
| Likes | ~10 | ~80,000 | **~80,000** |
| Comments | ~10 | ~40,000 | **~40,000** |
| Favorites | 3 | ~1,200 | **~1,200** |
| Blocks | 1 | ~50 | **~50** |
| Reviews | ~15 | ~800 | **~800** |

## Distribution Design

### Cast Post Frequency

| Category | Percentage | Posts |
|----------|------------|-------|
| Active | 30% | 250-300 |
| Normal | 50% | 100-150 |
| Low-frequency | 20% | 30-50 |

### Guest Activity Types

| Type | Percentage | Characteristics |
|------|------------|-----------------|
| Heavy user | 10% | Many follows, daily likes/comments |
| Active | 15% | Multiple follows, weekly activity |
| Normal | 55% | Moderate follows/likes |
| ROM | 20% | Few follows, likes only |

### Like/Comment Distribution

| Post Category | Percentage | Likes | Comments |
|---------------|------------|-------|----------|
| Viral | 1% | 100+ | 100-200 |
| Popular | 9% | 30-100 | 30-100 |
| Normal | 60% | 5-30 | 1-10 |
| Low engagement | 30% | 0-5 | 0-2 |

## Cast Data Structure

### Names (100 total)

| Category | Examples | Count |
|----------|----------|-------|
| Cute Japanese | 美咲、さくら、ゆい、あおい | 30 |
| Cool/Adult | れん、りお、かれん、なお | 25 |
| Unique | るな、のあ、ひなた、こはる | 25 |
| Elegant | 紗英、麗華、美蘭、瑠璃 | 20 |

### Profile Fields

```
catchphrase:  50 patterns
description:  30 patterns × combinations
visibility:   public: 85%, private: 15%
height:       150-172cm (normal distribution, avg 160cm)
age:          20-35 (skewed towards 20s)
genres:       1-3 per cast (random)
areas:        1-4 per cast (Tokyo/Osaka heavy)
```

## Guest Data Structure

### Names (400 total)

| Method | Count | Examples |
|--------|-------|----------|
| Static list | 100 | 太郎、健一、翔太、大輔、拓也 |
| Faker (Japanese) | 300 | Random Japanese names |

### Profile Fields

```
nickname:     Name or nickname style
description:  20 patterns × combinations
taggings:     VIP / First-timer / Regular (30% of active guests)
```

## Post Data Structure

### Content

```
templates:    100 patterns (daily, announcement, gratitude)
hashtags:     50 types (random selection)
visibility:   public: 90%, followers_only: 10%
```

### Time Distribution

```
past 1 month:     40% (active impression)
1-3 months ago:   30%
3-12 months ago:  30%
time of day:      skewed towards 18:00-24:00
```

## Relationship & Activity Data

### Follows (~4,000)

```
distribution:
  - Top 10% casts: 40% of all follows
  - Middle 60%: 50%
  - Bottom 30%: 10%
status:
  - approved: 95%
  - pending: 5%
```

### Blocks (~50)

```
cast → guest: 80%
guest → cast: 20%
constraint: No follow + block for same pair
```

### Favorites (~1,200)

```
Correlated with follows (30% of following = favorited)
```

### Comments (~40,000)

```
templates: 50 patterns
  「可愛い💕」「素敵です！」「会いたいです」
  「今度予約します！」「いつもありがとう」
distribution: Concentrated on popular posts
```

### Reviews (~800)

```
cast → guest: 400 (avg rating 4.2)
guest → cast: 400 (avg rating 4.5)
comment: 30 patterns × variations
```

## Implementation Structure

### File Structure

```
services/monolith/workspace/config/db/
├── seeds.rb                    # Existing (no changes)
├── seeds/
│   ├── trust_reviews.rb        # Existing (no changes)
│   └── bulk/                   # New directory
│       ├── generator.rb        # Main generation logic
│       ├── data/
│       │   ├── cast_names.rb
│       │   ├── guest_names.rb
│       │   ├── catchphrases.rb
│       │   ├── post_templates.rb
│       │   ├── comment_templates.rb
│       │   └── hashtags.rb
│       └── generators/
│           ├── cast_generator.rb
│           ├── guest_generator.rb
│           ├── post_generator.rb
│           ├── relationship_generator.rb
│           └── activity_generator.rb
```

### Execution

```bash
# Existing seeds + bulk data
bundle exec hanami db seed

# Or bulk data only
bundle exec ruby config/db/seeds/bulk/generator.rb
```

### Reproducibility

```ruby
SEED_VALUE = 12345
Random.srand(SEED_VALUE)
Faker::Config.random = Random.new(SEED_VALUE)
```

### Execution Order

```
1. Master Data   → areas, genres (existing)
2. Users         → identity__users (+97 casts, +396 guests)
3. Profiles      → portfolio__casts, portfolio__guests
4. Offers        → offer__plans, offer__schedules
5. Posts         → post__posts, post__hashtags
6. Relationships → follows, blocks, favorites
7. Activities    → likes, comments
8. Trust         → taggings, reviews
```

## Constraints

- Existing 7 users preserved for test scenarios
- No follow + block for same user pair
- No likes/comments between blocked users
- All test passwords: `0000`
