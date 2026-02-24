# frozen_string_literal: true

module Seeds
  module Bulk
    module Config
      # Seed value for reproducibility
      SEED_VALUE = 12345

      # Data volume
      CAST_COUNT = 97        # 97 new + 3 existing = 100
      GUEST_COUNT = 396      # 396 new + 4 existing = 400

      # Post distribution
      POST_DISTRIBUTION = {
        active: { ratio: 0.30, min: 250, max: 300 },   # 30% of casts
        normal: { ratio: 0.50, min: 100, max: 150 },   # 50% of casts
        low: { ratio: 0.20, min: 30, max: 50 },        # 20% of casts
      }.freeze

      # Guest activity types
      GUEST_ACTIVITY = {
        heavy: { ratio: 0.10, follows: 15..25, likes_per_day: 10, comments: 20..50 },
        active: { ratio: 0.15, follows: 10..15, likes_per_day: 5, comments: 10..20 },
        normal: { ratio: 0.55, follows: 5..10, likes_per_day: 2, comments: 3..10 },
        rom: { ratio: 0.20, follows: 2..5, likes_per_day: 1, comments: 0..3 },
      }.freeze

      # Like/Comment distribution per post
      POST_ENGAGEMENT = {
        viral: { ratio: 0.01, likes: 100..300, comments: 100..200 },
        popular: { ratio: 0.09, likes: 30..100, comments: 30..100 },
        normal: { ratio: 0.60, likes: 5..30, comments: 1..10 },
        low: { ratio: 0.30, likes: 0..5, comments: 0..2 },
      }.freeze

      # Relationship settings
      FOLLOW_APPROVAL_RATE = 0.95  # 95% approved, 5% pending
      FAVORITE_FROM_FOLLOW_RATE = 0.30  # 30% of follows become favorites
      BLOCK_COUNT = 50

      # Review settings
      REVIEW_COUNT_PER_DIRECTION = 400  # 400 cast->guest, 400 guest->cast

      # Time settings
      POST_TIME_RANGE_DAYS = 365  # Posts from past 1 year
      POST_RECENT_WEIGHT = 0.40  # 40% in last month

      # Visibility settings
      CAST_PRIVATE_RATE = 0.15  # 15% private casts
      POST_PRIVATE_RATE = 0.10  # 10% followers-only posts
    end
  end
end
