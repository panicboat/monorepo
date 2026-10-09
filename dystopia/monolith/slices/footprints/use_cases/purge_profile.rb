# frozen_string_literal: true

module Footprints
  module UseCases
    class PurgeProfile
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(profile_id:)
        footprints_repo.delete_visits_by_profile(profile_id)
        footprints_repo.delete_read_state_by_profile(profile_id)
        nil
      end
    end
  end
end
