# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Profile
        class GetProfile
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          # Find cast profile by user_id (PK = user_id)
          # @param user_id [String, nil] User ID to search by
          # @param id [String, nil] User ID to search by (takes precedence if both provided)
          def call(user_id: nil, id: nil)
            if id && !id.empty?
              repo.find_with_plans(id)
            elsif user_id && !user_id.empty?
              repo.find_by_user_id_with_plans(user_id)
            end
          end
        end
      end
    end
  end
end
