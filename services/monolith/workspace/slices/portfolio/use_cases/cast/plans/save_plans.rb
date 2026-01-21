# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Plans
        class SavePlans
          class ValidationError < StandardError
            attr_reader :errors

            def initialize(errors)
              @errors = errors
              super(errors.to_h.to_s)
            end
          end

          include Portfolio::Deps[
            repo: "repositories.cast_repository",
            contract: "contracts.cast.save_plans_contract"
          ]

          def call(cast_id:, plans:)
            # 0. Input Validation
            validation = contract.call(cast_id: cast_id, plans: plans)
            raise ValidationError, validation.errors unless validation.success?

            # plans is an array of hashes: [{name:, price:, duration_minutes:}]
            repo.save_plans(id: cast_id, plans_data: plans)
          end
        end
      end
    end
  end
end
