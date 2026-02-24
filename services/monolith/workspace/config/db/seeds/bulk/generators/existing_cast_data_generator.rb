# frozen_string_literal: true

require_relative "base_generator"
require_relative "../data/post_templates"
require_relative "../data/comment_templates"
require_relative "../config"

module Seeds
  module Bulk
    module Generators
      # Generator for adding large amounts of posts and comments to existing base casts
      # Used for load testing and pagination verification
      class ExistingCastDataGenerator < BaseGenerator
        # Configuration for existing cast data generation
        EXISTING_CAST_CONFIG = {
          posts_per_cast: 200,           # Number of posts per cast
          comments_per_post: {           # Comments distribution
            min: 5,
            max: 30,
            viral_min: 50,
            viral_max: 100
          },
          viral_post_ratio: 0.05,        # 5% of posts are viral (many comments)
          reply_rate: 0.3,               # 30% of comments get a reply from cast
          time_range_days: 365           # Posts spread over 1 year
        }.freeze

        def call
          puts ""
          puts "=" * 80
          puts "Generating data for existing base casts..."
          puts "=" * 80
          puts ""

          existing_casts = fetch_existing_casts
          existing_guests = fetch_existing_guests

          if existing_casts.empty?
            puts "  No existing base casts found. Run base seeds first."
            return
          end

          if existing_guests.empty?
            puts "  No existing guests found. Run base seeds first."
            return
          end

          puts "  Found #{existing_casts.size} existing casts"
          puts "  Found #{existing_guests.size} existing guests"
          puts "  Posts per cast: #{EXISTING_CAST_CONFIG[:posts_per_cast]}"
          puts "  Comments per post: #{EXISTING_CAST_CONFIG[:comments_per_post][:min]}-#{EXISTING_CAST_CONFIG[:comments_per_post][:max]}"
          puts ""

          total_posts = 0
          total_comments = 0

          existing_casts.each_with_index do |cast, idx|
            puts "Processing cast #{idx + 1}/#{existing_casts.size}: #{cast[:name]} (#{cast[:slug]})"

            post_count, comment_count = generate_data_for_cast(cast, existing_guests)
            total_posts += post_count
            total_comments += comment_count

            puts "  → Created #{post_count} posts, #{comment_count} comments"
          end

          puts ""
          puts "=" * 80
          puts "Existing cast data generation completed!"
          puts "  Total posts: #{total_posts}"
          puts "  Total comments: #{total_comments}"
          puts "=" * 80
        end

        private

        def fetch_existing_casts
          # Fetch the 3 base casts by their known slugs
          base_slugs = %w[yuna mio rin]
          casts = []

          base_slugs.each do |slug|
            cast = db[:portfolio__casts].where(slug: slug).first
            casts << cast if cast
          end

          casts
        end

        def fetch_existing_guests
          # Fetch all existing guests with their user_ids
          db[:portfolio__guests].all.to_a
        end

        def generate_data_for_cast(cast, guests)
          cast_user_id = cast[:user_id]
          guest_user_ids = guests.map { |g| g[:user_id] }

          post_count = 0
          comment_count = 0

          EXISTING_CAST_CONFIG[:posts_per_cast].times do |i|
            is_viral = rand < EXISTING_CAST_CONFIG[:viral_post_ratio]

            # Create post
            post_id = create_post(cast[:id], i)
            post_count += 1

            # Create comments
            comment_config = EXISTING_CAST_CONFIG[:comments_per_post]
            num_comments = if is_viral
              rand(comment_config[:viral_min]..comment_config[:viral_max])
            else
              rand(comment_config[:min]..comment_config[:max])
            end

            created = create_comments_for_post(post_id, cast_user_id, guest_user_ids, num_comments)
            comment_count += created

            print "." if (i % 50).zero?
          end

          puts ""
          [post_count, comment_count]
        end

        def create_post(cast_id, index)
          template = Data::POST_TEMPLATES.sample
          content = format_template(template)
          visibility = rand < 0.1 ? "private" : "public"
          created_at = random_post_time(index)

          post_id = db[:"post__posts"].insert(
            cast_id: cast_id,
            content: content,
            visibility: visibility,
            created_at: created_at,
            updated_at: created_at
          )

          create_hashtags(post_id)
          post_id
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

        def random_post_time(index)
          # Distribute posts over the time range, with more recent posts having more weight
          days_ago = EXISTING_CAST_CONFIG[:time_range_days]

          if rand < 0.4
            # 40% in last month
            days = rand(0..30)
          else
            # 60% spread over the rest of the year
            days = rand(30..days_ago)
          end

          base_time = Time.now - (days * 86400)
          hour = evening_biased_hour
          Time.new(base_time.year, base_time.month, base_time.day, hour, rand(0..59), rand(0..59))
        end

        def create_comments_for_post(post_id, cast_user_id, guest_user_ids, num_comments)
          post = db[:"post__posts"].where(id: post_id).first
          return 0 unless post

          count = 0

          num_comments.times do |i|
            guest_user_id = guest_user_ids.sample
            next unless guest_user_id

            comment_created_at = post[:created_at] + rand(60..86400 * 7) # Within 1 week of post

            comment_id = db[:"post__comments"].insert(
              post_id: post_id,
              user_id: guest_user_id,
              content: Data::GUEST_COMMENTS.sample,
              parent_id: nil,
              replies_count: 0,
              created_at: comment_created_at
            )
            count += 1

            # Cast reply (30% chance)
            if rand < EXISTING_CAST_CONFIG[:reply_rate] && cast_user_id
              reply_created_at = comment_created_at + rand(300..86400) # 5min to 1 day after comment

              db[:"post__comments"].insert(
                post_id: post_id,
                user_id: cast_user_id,
                content: Data::CAST_REPLIES.sample,
                parent_id: comment_id,
                replies_count: 0,
                created_at: reply_created_at
              )
              db[:"post__comments"].where(id: comment_id).update(replies_count: 1)
              count += 1
            end
          end

          count
        end
      end
    end
  end
end

# Run if executed directly
if __FILE__ == $0
  require_relative "../../../../app"
  Hanami.boot

  Seeds::Bulk::Generators::ExistingCastDataGenerator.new.call
end
