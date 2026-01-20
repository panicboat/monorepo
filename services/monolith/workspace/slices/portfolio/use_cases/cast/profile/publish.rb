# frozen_string_literal: true

module Portfolio
  module UseCases
    module Cast
      module Profile
        class Publish
          include Portfolio::Deps[repo: "repositories.cast_repository"]

          def call(cast_id:, status:)
            repo.update_status(cast_id, status)
          end
        end
      end
    end
  end
end
