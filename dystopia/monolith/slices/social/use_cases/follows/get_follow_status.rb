# frozen_string_literal: true

module Social
  module UseCases
    module Follows
      class GetFollowStatus
        include Social::Deps[follow_repo: "repositories.follow_repository"]

        def call(follower_profile_id:, target_profile_ids:)
          target_profile_ids = (target_profile_ids || []).compact.uniq
          present = follow_repo.status_batch(follower_profile_id: follower_profile_id, followee_profile_ids: target_profile_ids)
          visible_ids = list_visible_profile_ids.call(profile_ids: present.keys)
          approval_required_ids = list_follow_approval_required_ids.call(profile_ids: target_profile_ids)
          {
            statuses: target_profile_ids.to_h { |id| [id.to_s, visible_ids.include?(id.to_s) ? present[id.to_s] : "none"] },
            approval_required: target_profile_ids.to_h { |id| [id.to_s, approval_required_ids.include?(id.to_s)] }
          }
        end

        private

        def list_follow_approval_required_ids
          @list_follow_approval_required_ids ||= Profile::Slice["use_cases.list_follow_approval_required_ids"]
        end

        def list_visible_profile_ids
          @list_visible_profile_ids ||= Profile::Slice["use_cases.list_visible_profile_ids"]
        end
      end
    end
  end
end
