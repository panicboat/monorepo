# frozen_string_literal: true

module Portfolio
  module UseCases
    module Guest
      class GetProfileById
        include Deps[
          "repositories.guest_repository",
          "repositories.cast_repository"
        ]

        def call(guest_id:, cast_user_id:)
          cast = cast_repository.find_by_user_id(cast_user_id)
          return nil unless cast

          guest = guest_repository.find_by_id(guest_id)
          return nil unless guest

          { guest: guest, cast_user_id: cast.user_id }
        end
      end
    end
  end
end
