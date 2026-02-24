# frozen_string_literal: true

require_relative "base_generator"
require_relative "../data/post_templates"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      class PostGenerator < BaseGenerator
        def call(cast_ids:)
          puts "Generating posts for #{cast_ids.size} casts..."

          all_post_ids = []
          post_categories = {}

          cast_ids.each_with_index do |cast_id, idx|
            existing = db[:"post__posts"].where(cast_id: cast_id).count
            next if existing > 0

            post_count = determine_post_count(idx, cast_ids.size)
            post_ids = create_posts(cast_id, post_count)

            all_post_ids.concat(post_ids)
            post_ids.each do |post_id|
              post_categories[post_id] = assign_engagement_category
            end

            print "." if (idx % 10).zero?
          end

          puts ""
          puts "  Created #{all_post_ids.size} posts"

          { post_ids: all_post_ids, post_categories: post_categories }
        end

        private

        def determine_post_count(index, total)
          dist = Config::POST_DISTRIBUTION
          active_count = (total * dist[:active][:ratio]).to_i
          normal_count = (total * dist[:normal][:ratio]).to_i

          if index < active_count
            rand(dist[:active][:min]..dist[:active][:max])
          elsif index < active_count + normal_count
            rand(dist[:normal][:min]..dist[:normal][:max])
          else
            rand(dist[:low][:min]..dist[:low][:max])
          end
        end

        def create_posts(cast_id, count)
          post_ids = []
          templates = Data::POST_TEMPLATES.dup

          count.times do |i|
            template = templates.sample
            content = format_template(template)
            visibility = rand < Config::POST_PRIVATE_RATE ? "private" : "public"
            created_at = random_time_in_past(
              days: Config::POST_TIME_RANGE_DAYS,
              recent_weight: Config::POST_RECENT_WEIGHT
            )

            # Adjust time to evening hours
            created_at = created_at.to_time
            created_at = Time.new(
              created_at.year, created_at.month, created_at.day,
              evening_biased_hour, rand(0..59), rand(0..59)
            )

            post_id = db[:"post__posts"].insert(
              cast_id: cast_id,
              content: content,
              visibility: visibility,
              created_at: created_at,
              updated_at: created_at
            )

            create_hashtags(post_id)
            post_ids << post_id
          end

          post_ids
        end

        def format_template(template)
          template
            .gsub("%{area}", Data::AREAS_FOR_POSTS.sample)
            .gsub("%{time}", Data::TIMES_FOR_POSTS.sample)
        end

        def create_hashtags(post_id)
          hashtags = Data::HASHTAGS.sample(rand(1..4))
          hashtags.each_with_index do |tag, position|
            db[:"post__hashtags"].insert(
              post_id: post_id,
              tag: tag,
              position: position,
              created_at: Time.now
            )
          end
        end

        def assign_engagement_category
          categories = Config::POST_ENGAGEMENT.keys
          weights = Config::POST_ENGAGEMENT.values.map { |v| v[:ratio] }
          weighted_sample(categories, weights)
        end
      end
    end
  end
end
