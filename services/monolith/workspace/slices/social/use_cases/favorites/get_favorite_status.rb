# frozen_string_literal: true

module Social
  module UseCases
    module Favorites
      class GetFavoriteStatus
        include Social::Deps[favorite_repo: "repositories.favorite_repository"]

        def call(cast_ids:, guest_id:)
          favorite_repo.favorite_status_batch(cast_ids: cast_ids, guest_id: guest_id)
        end
      end
    end
  end
end
