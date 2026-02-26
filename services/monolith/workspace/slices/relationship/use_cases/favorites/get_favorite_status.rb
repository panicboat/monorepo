# frozen_string_literal: true

module Relationship
  module UseCases
    module Favorites
      class GetFavoriteStatus
        include Relationship::Deps[favorite_repo: "repositories.favorite_repository"]

        def call(cast_user_ids:, guest_user_id:)
          favorite_repo.favorite_status_batch(cast_user_ids: cast_user_ids, guest_user_id: guest_user_id)
        end
      end
    end
  end
end
