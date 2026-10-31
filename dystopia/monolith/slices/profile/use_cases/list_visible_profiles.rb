# frozen_string_literal: true

module Profile
  module UseCases
    class ListVisibleProfiles
      include Deps["repositories.profile_repository"]

      def call(profile_ids:)
        ids = Array(profile_ids).compact.map(&:to_s).uniq
        by_id = profile_repository.list_visible_by_ids(ids).to_h { |profile| [profile.id.to_s, profile] }
        by_id.values_at(*ids).compact
      end
    end
  end
end
