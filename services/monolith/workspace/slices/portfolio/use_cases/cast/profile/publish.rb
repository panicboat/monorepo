# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Profile
        class Publish
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(cast_id:, visibility:)
            cast = repo.find_by_id(cast_id)
            return unless cast

            # If this is the first time publishing (completing onboarding), set registered_at
            if cast.registered_at.nil?
              repo.complete_registration(cast_id)
            end

            repo.save_visibility(cast_id, visibility)
          end
        end
      end
    end
  end
end
