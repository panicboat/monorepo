# frozen_string_literal: true

module Profile
  module UseCases
    class GetProfile
      include Deps["repositories.profile_repository"]

      def call(profile_id:)
        profile_repository.find_visible_by_id(profile_id)
      end
    end
  end
end
