# frozen_string_literal: true

module Offer
  module UseCases
    module Plans
      class SavePlans
        class ValidationError < StandardError
          attr_reader :errors

          def initialize(errors)
            @errors = errors
            super(errors.to_h.to_s)
          end
        end

        class CastNotFoundError < StandardError; end

        include Offer::Deps[
          repo: "repositories.offer_repository",
          contract: "contracts.save_plans_contract",
          portfolio_adapter: "adapters.portfolio_adapter"
        ]

        def call(cast_id:, plans:)
          # 0. Input Validation
          validation = contract.call(cast_id: cast_id, plans: plans)
          raise ValidationError, validation.errors unless validation.success?

          # 1. Verify cast exists via adapter
          raise CastNotFoundError, "Cast not found" unless portfolio_adapter.cast_exists?(cast_id)

          # 2. Save plans
          repo.save_plans(cast_id: cast_id, plans_data: plans)
        end
      end
    end
  end
end
