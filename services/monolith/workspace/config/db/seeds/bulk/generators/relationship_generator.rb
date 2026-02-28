# frozen_string_literal: true

require_relative "base_generator"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class RelationshipGenerator < BaseGenerator
        def call(cast_user_ids:, guest_user_ids:, activity_types:)
          puts "Generating relationships..."

          follows = create_follows(cast_user_ids, guest_user_ids, activity_types)
          blocks = create_blocks(cast_user_ids, guest_user_ids, follows)

          puts "  Created #{follows.size} follows, #{blocks.size} blocks"

          { follows: follows, blocks: blocks }
        end

        private

        def create_follows(cast_user_ids, guest_user_ids, activity_types)
          follows = []

          # Build popularity weights for casts (Pareto distribution)
          cast_weights = build_cast_popularity_weights(cast_user_ids)

          guest_user_ids.each do |guest_user_id|
            existing_follows = db[:"relationship__follows"].where(guest_user_id: guest_user_id).select_map(:cast_user_id)
            next if existing_follows.any?

            activity = activity_types[guest_user_id] || :normal
            follow_range = Config::GUEST_ACTIVITY[activity][:follows]
            follow_count = rand(follow_range)

            # Select casts based on popularity
            selected_casts = weighted_select_casts(cast_user_ids, cast_weights, follow_count)

            selected_casts.each do |cast_user_id|
              status = rand < Config::FOLLOW_APPROVAL_RATE ? "approved" : "pending"

              db[:"relationship__follows"].insert(
                guest_user_id: guest_user_id,
                cast_user_id: cast_user_id,
                status: status,
                created_at: random_time_in_past(days: 180)
              )

              follows << { guest_user_id: guest_user_id, cast_user_id: cast_user_id, status: status }
            end
          end

          follows
        end

        def build_cast_popularity_weights(cast_user_ids)
          # Top 10% get 40% of follows
          # Middle 60% get 50% of follows
          # Bottom 30% get 10% of follows
          weights = []
          top_count = (cast_user_ids.size * 0.10).to_i
          middle_count = (cast_user_ids.size * 0.60).to_i

          cast_user_ids.each_with_index do |_, idx|
            weight = if idx < top_count
                       4.0
                     elsif idx < top_count + middle_count
                       0.83
                     else
                       0.33
                     end
            weights << weight
          end

          weights
        end

        def weighted_select_casts(cast_user_ids, weights, count)
          selected = []
          available_indices = (0...cast_user_ids.size).to_a

          count.times do
            break if available_indices.empty?

            available_weights = available_indices.map { |i| weights[i] }
            total = available_weights.sum
            random = rand * total
            cumulative = 0

            selected_idx = available_indices.find do |i|
              cumulative += weights[i]
              random <= cumulative
            end || available_indices.last

            selected << cast_user_ids[selected_idx]
            available_indices.delete(selected_idx)
          end

          selected
        end

        def create_blocks(cast_user_ids, guest_user_ids, follows)
          blocks = []

          Config::BLOCK_COUNT.times do
            # Only Cast→Guest blocks are supported
            cast_user_id = cast_user_ids.sample
            guest_user_id = guest_user_ids.sample
            next unless cast_user_id && guest_user_id

            existing = db[:"relationship__blocks"].where(
              blocker_id: cast_user_id, blocked_id: guest_user_id
            ).first
            next if existing

            db[:"relationship__blocks"].insert(
              blocker_id: cast_user_id,
              blocker_type: "cast",
              blocked_id: guest_user_id,
              blocked_type: "guest",
              created_at: Time.now
            )
            blocks << { blocker_id: cast_user_id, blocked_id: guest_user_id }
          end

          blocks
        end

      end
    end
  end
end
