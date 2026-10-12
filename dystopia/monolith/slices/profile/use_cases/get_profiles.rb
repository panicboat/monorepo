# frozen_string_literal: true

module Profile
  module UseCases
    class GetProfiles
      include Deps["repositories.profile_repository"]

      def call(profile_ids:)
        profile_repository.find_visible_by_ids(profile_ids)
      end
    end
  end
end
