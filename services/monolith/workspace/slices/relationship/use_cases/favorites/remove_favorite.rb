# frozen_string_literal: true

module Relationship
  module UseCases
    module Favorites
      class RemoveFavorite
        include Relationship::Deps[favorite_repo: "repositories.favorite_repository"]

        def call(cast_user_id:, guest_user_id:)
          favorite_repo.remove_favorite(cast_user_id: cast_user_id, guest_user_id: guest_user_id)
          { success: true }
        end
      end
    end
  end
end
