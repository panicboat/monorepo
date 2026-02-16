# frozen_string_literal: true

module Relationship
  module UseCases
    module Favorites
      class AddFavorite
        include Relationship::Deps[favorite_repo: "repositories.favorite_repository"]

        def call(cast_id:, guest_id:)
          favorite_repo.add_favorite(cast_id: cast_id, guest_id: guest_id)
          { success: true }
        end
      end
    end
  end
end
