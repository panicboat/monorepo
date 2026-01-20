# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Plans
        class SavePlans
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(cast_id:, plans:)
            # plans is an array of hashes: [{name:, price:, duration_minutes:}]
            repo.update_plans(id: cast_id, plans_data: plans)
          end
        end
      end
    end
  end
end
