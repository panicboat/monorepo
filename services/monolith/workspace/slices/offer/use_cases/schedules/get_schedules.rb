# frozen_string_literal: true

module Offer
  module UseCases
    module Schedules
      class GetSchedules
        class CastNotFoundError < StandardError; end

        include Offer::Deps[
          repo: "repositories.offer_repository",
          portfolio_adapter: "adapters.portfolio_adapter"
        ]

        def call(cast_id:, start_date: nil, end_date: nil)
          # Verify cast exists via adapter
          raise CastNotFoundError, "Cast not found" unless portfolio_adapter.cast_exists?(cast_id)

          repo.find_schedules_by_cast_id(cast_id, start_date: start_date, end_date: end_date)
        end
      end
    end
  end
end
