# frozen_string_literal: true

require "set"

module Social
  module UseCases
    class ListLockPassableProfileIds
      include Social::Deps[follow_repo: "repositories.follow_repository"]

      def call(viewer_profile_id:, profile_ids:)
        ids = profile_ids.compact.map { |id| id.to_s.downcase }.uniq
        locked = list_locked_profile_ids.call(profile_ids: ids).map(&:to_s)
        passable = (ids - locked).to_set
        return passable if viewer_profile_id.nil? || locked.empty?

        viewer = viewer_profile_id.to_s.downcase
        passable << viewer if locked.include?(viewer)
        statuses = follow_repo.status_batch(follower_profile_id: viewer, followee_profile_ids: locked)
        passable.merge(statuses.select { |_, status| status == "approved" }.keys)
      end

      private

      def list_locked_profile_ids
        @list_locked_profile_ids ||= Profile::Slice["use_cases.list_locked_profile_ids"]
      end
    end
  end
end
