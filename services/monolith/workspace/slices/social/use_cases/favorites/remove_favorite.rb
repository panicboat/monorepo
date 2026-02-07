# frozen_string_literal: true

module Social
  module UseCases
    module Favorites
      class RemoveFavorite
        include Social::Deps[favorite_repo: "repositories.favorite_repository"]

        def call(cast_id:, guest_id:)
          favorite_repo.remove_favorite(cast_id: cast_id, guest_id: guest_id)
          { success: true }
        end
      end
    end
  end
end
