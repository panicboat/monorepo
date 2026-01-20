# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Schedules
        class SaveSchedules
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(cast_id:, schedules:)
            repo.save_schedules(id: cast_id, schedules: schedules)
            repo.find_with_plans(cast_id)
          end
        end
      end
    end
  end
end
