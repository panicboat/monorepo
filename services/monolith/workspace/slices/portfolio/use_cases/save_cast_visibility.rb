# frozen_string_literal: true

module Portfolio
  module UseCases
    class SaveCastVisibility
      include Portfolio::Deps[cast_repo: "repositories.cast_repository"]

      # @return [Hash] { success: Boolean, cast: Cast, visibility_changed_to_public: Boolean }
      def call(user_id:, visibility:)
        cast = cast_repo.find_by_user_id(user_id)
        return { success: false, error: :cast_not_found } unless cast

        old_visibility = cast.visibility
        cast_repo.save_visibility(cast.id, visibility)

        updated_cast = cast_repo.find_by_user_id_with_plans(user_id)
        {
          success: true,
          cast: updated_cast,
          visibility_changed_to_public: old_visibility == "private" && visibility == "public"
        }
      end
    end
  end
end
