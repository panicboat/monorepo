# frozen_string_literal: true

require_relative "base_generator"
require_relative "../data/comment_templates"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class ActivityGenerator < BaseGenerator
        def call(post_ids:, post_categories:, guest_user_ids:, cast_user_ids:, blocks:)
          puts "Generating activities (likes, comments, reviews)..."

          @blocked_pairs = build_blocked_pairs(blocks)

          likes_count = create_likes(post_ids, post_categories, guest_user_ids)
          comments_count = create_comments(post_ids, post_categories, guest_user_ids)
          reviews_count = create_reviews(cast_user_ids, guest_user_ids)

          puts "  Created #{likes_count} likes, #{comments_count} comments, #{reviews_count} reviews"
        end

        private

        def build_blocked_pairs(blocks)
          pairs = Set.new
          blocks.each do |b|
            pairs << [b[:blocker_id], b[:blocked_id]]
            pairs << [b[:blocked_id], b[:blocker_id]]
          end
          pairs
        end

        def create_likes(post_ids, post_categories, guest_user_ids)
          count = 0

          post_ids.each_with_index do |post_id, idx|
            post = db[:"post__posts"].where(id: post_id).first
            next unless post

            cast_user_id = post[:cast_user_id]
            category = post_categories[post_id] || :normal
            engagement = Config::POST_ENGAGEMENT[category]
            like_count = rand(engagement[:likes])

            eligible_guests = guest_user_ids.reject do |guest_user_id|
              @blocked_pairs.include?([guest_user_id, cast_user_id])
            end

            selected_guests = eligible_guests.sample([like_count, eligible_guests.size].min)

            selected_guests.each do |guest_user_id|
              existing = db[:"post__likes"].where(guest_user_id: guest_user_id, post_id: post_id).first
              next if existing

              db[:"post__likes"].insert(
                guest_user_id: guest_user_id,
                post_id: post_id,
                created_at: post[:created_at] + rand(1..86400)
              )
              count += 1
            end

            print "." if (idx % 500).zero?
          end

          puts ""
          count
        end

        def create_comments(post_ids, post_categories, guest_user_ids)
          count = 0

          post_ids.each_with_index do |post_id, idx|
            post = db[:"post__posts"].where(id: post_id).first
            next unless post

            cast_user_id = post[:cast_user_id]
            category = post_categories[post_id] || :normal
            engagement = Config::POST_ENGAGEMENT[category]
            comment_count = rand(engagement[:comments])

            eligible_guests = guest_user_ids.reject do |guest_user_id|
              @blocked_pairs.include?([guest_user_id, cast_user_id])
            end

            comment_count.times do
              guest_user_id = eligible_guests.sample
              next unless guest_user_id

              comment_id = db[:"post__comments"].insert(
                post_id: post_id,
                user_id: guest_user_id,
                content: Data::GUEST_COMMENTS.sample,
                parent_id: nil,
                replies_count: 0,
                created_at: post[:created_at] + rand(1..86400)
              )
              count += 1

              # Cast reply (30% chance)
              if rand < 0.3 && cast_user_id
                db[:"post__comments"].insert(
                  post_id: post_id,
                  user_id: cast_user_id,
                  content: Data::CAST_REPLIES.sample,
                  parent_id: comment_id,
                  replies_count: 0,
                  created_at: post[:created_at] + rand(86400..172800)
                )
                db[:"post__comments"].where(id: comment_id).update(replies_count: 1)
                count += 1
              end
            end

            print "." if (idx % 500).zero?
          end

          puts ""
          count
        end

        def create_reviews(cast_user_ids, guest_user_ids)
          count = 0

          # Guest -> Cast reviews
          Config::REVIEW_COUNT_PER_DIRECTION.times do
            guest_user_id = guest_user_ids.sample
            cast_user_id = cast_user_ids.sample

            next unless guest_user_id && cast_user_id
            next if @blocked_pairs.include?([guest_user_id, cast_user_id])

            existing = db[:trust__reviews].where(
              reviewer_id: guest_user_id, reviewee_id: cast_user_id
            ).first
            next if existing

            db[:trust__reviews].insert(
              id: SecureRandom.uuid,
              reviewer_id: guest_user_id,
              reviewee_id: cast_user_id,
              content: Data::GUEST_REVIEW_COMMENTS.sample,
              score: weighted_sample([3, 4, 5], [10, 30, 60]),
              status: rand < 0.9 ? "approved" : "pending",
              created_at: random_time_in_past(days: 180),
              updated_at: Time.now
            )
            count += 1
          end

          # Cast -> Guest reviews
          Config::REVIEW_COUNT_PER_DIRECTION.times do
            cast_user_id = cast_user_ids.sample
            guest_user_id = guest_user_ids.sample

            next unless cast_user_id && guest_user_id

            existing = db[:trust__reviews].where(
              reviewer_id: cast_user_id, reviewee_id: guest_user_id
            ).first
            next if existing

            comment = Data::CAST_REVIEW_COMMENTS.sample

            db[:trust__reviews].insert(
              id: SecureRandom.uuid,
              reviewer_id: cast_user_id,
              reviewee_id: guest_user_id,
              content: comment,
              score: weighted_sample([2, 3, 4, 5], [5, 15, 40, 40]),
              status: "approved",
              created_at: random_time_in_past(days: 180),
              updated_at: Time.now
            )
            count += 1
          end

          count
        end
      end
    end
  end
end
