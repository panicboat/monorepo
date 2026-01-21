# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Schedules
        class SaveSchedules
          class ValidationError < StandardError
            attr_reader :errors

            def initialize(errors)
              @errors = errors
              super(errors.to_h.to_s)
            end
          end

          include Portfolio::Deps[
            repo: "repositories.cast_repository",
            contract: "contracts.cast.save_schedules_contract"
          ]

          def call(cast_id:, schedules:)
            # 0. Input Validation
            validation = contract.call(cast_id: cast_id, schedules: schedules)
            raise ValidationError, validation.errors unless validation.success?

            repo.save_schedules(id: cast_id, schedules: schedules)
            repo.find_with_plans(cast_id)
          end
        end
      end
    end
  end
end
