# frozen_string_literal: true

require "bcrypt"
require "securerandom"

module Seeds
  module Bulk
    module Generators
      class BaseGenerator
        PASSWORD_DIGEST = BCrypt::Password.create("0000")

        def initialize
          @db = Hanami.app["db.gateway"].connection
        end

        protected

        attr_reader :db

        def weighted_sample(items, weights)
          total = weights.sum
          random = rand * total
          cumulative = 0

          items.zip(weights).each do |item, weight|
            cumulative += weight
            return item if random <= cumulative
          end

          items.last
        end

        def random_time_in_past(days:, recent_weight: 0.4)
          if rand < recent_weight
            # Recent (last 30 days)
            Time.now - rand(0..30) * 86400 - rand(0..86400)
          else
            # Older (30 days to `days` days ago)
            Time.now - rand(30..days) * 86400 - rand(0..86400)
          end
        end

        def evening_biased_hour
          # Bias towards 18:00-24:00
          if rand < 0.7
            rand(18..23)
          else
            rand(10..17)
          end
        end
      end
    end
  end
end
