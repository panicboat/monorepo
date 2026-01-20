# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Profile
        class Publish
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(cast_id:, visibility:)
            repo.update_visibility(cast_id, visibility)
          end
        end
      end
    end
  end
end
