# frozen_string_literal: true

module Offer
  module UseCases
    module Plans
      class GetPlans
        class CastNotFoundError < StandardError; end

        include Offer::Deps[
          repo: "repositories.offer_repository",
          portfolio_adapter: "adapters.portfolio_adapter"
        ]

        def call(cast_id:)
          # Verify cast exists via adapter
          raise CastNotFoundError, "Cast not found" unless portfolio_adapter.cast_exists?(cast_id)

          repo.find_plans_by_cast_id(cast_id)
        end
      end
    end
  end
end
