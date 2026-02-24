# frozen_string_literal: true

require_relative "config"
require_relative "generators/cast_generator"
require_relative "generators/guest_generator"
require_relative "generators/post_generator"
require_relative "generators/relationship_generator"
require_relative "generators/activity_generator"

module Seeds
  module Bulk
    class Generator
      def self.call
        new.call
      end

      def call
        setup_random_seed
        start_time = Time.now

        puts ""
        puts "=" * 80
        puts "Bulk Seed Data Generation"
        puts "=" * 80
        puts ""
        puts "Configuration:"
        puts "  Casts: #{Config::CAST_COUNT} new (#{Config::CAST_COUNT + 3} total)"
        puts "  Guests: #{Config::GUEST_COUNT} new (#{Config::GUEST_COUNT + 4} total)"
        puts "  Seed value: #{Config::SEED_VALUE}"
        puts ""

        # Generate casts
        cast_result = Generators::CastGenerator.new.call

        # Generate guests
        guest_result = Generators::GuestGenerator.new.call

        # Generate posts
        post_result = Generators::PostGenerator.new.call(
          cast_ids: cast_result[:cast_ids]
        )

        # Generate relationships
        relationship_result = Generators::RelationshipGenerator.new.call(
          cast_ids: cast_result[:cast_ids],
          guest_ids: guest_result[:guest_ids],
          activity_types: guest_result[:activity_types]
        )

        # Generate activities (likes, comments, reviews)
        Generators::ActivityGenerator.new.call(
          post_ids: post_result[:post_ids],
          post_categories: post_result[:post_categories],
          guest_ids: guest_result[:guest_ids],
          cast_ids: cast_result[:cast_ids],
          blocks: relationship_result[:blocks]
        )

        elapsed = Time.now - start_time
        puts ""
        puts "=" * 80
        puts "Bulk seed generation completed in #{elapsed.round(2)} seconds"
        puts "=" * 80
        puts ""
      end

      private

      def setup_random_seed
        Random.srand(Config::SEED_VALUE)

        # Faker seed if available
        if defined?(Faker)
          Faker::Config.random = Random.new(Config::SEED_VALUE)
        end
      end
    end
  end
end

# Run if executed directly
if __FILE__ == $0
  require_relative "../../../../app"
  Hanami.boot

  Seeds::Bulk::Generator.call
end
