# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Profile
        class GetProfile
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(user_id:)
            repo.find_by_user_id_with_plans(user_id)
          end
        end
      end
    end
  end
end
