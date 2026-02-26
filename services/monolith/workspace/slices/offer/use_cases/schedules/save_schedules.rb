# frozen_string_literal: true

require "errors/validation_error"

module Offer
  module UseCases
    module Schedules
      class SaveSchedules
        class CastNotFoundError < StandardError; end

        include Offer::Deps[
          repo: "repositories.offer_repository",
          contract: "contracts.save_schedules_contract",
          portfolio_adapter: "adapters.portfolio_adapter"
        ]

        def call(cast_user_id:, schedules:)
          # 0. Input Validation
          validation = contract.call(cast_user_id: cast_user_id, schedules: schedules)
          raise Errors::ValidationError, validation.errors unless validation.success?

          # 1. Verify cast exists via adapter
          raise CastNotFoundError, "Cast not found" unless portfolio_adapter.cast_exists?(cast_user_id)

          # 2. Save schedules
          repo.save_schedules(cast_user_id: cast_user_id, schedules_data: schedules)
        end
      end
    end
  end
end
