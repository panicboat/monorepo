# frozen_string_literal: true

module Footprints
  module UseCases
    class GetUnreadCount
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(profile_id:)
        unread_visitor_ids = footprints_repo.unread_visitor_profile_ids(profile_id: profile_id)
        listed_visitor_ids = Profile::Slice["use_cases.list_visible_profile_ids"].call(profile_ids: unread_visitor_ids)
        (listed_visitor_ids - excluded_visitor_profile_ids_for(profile_id)).size
      end

      private

      def excluded_visitor_profile_ids_for(profile_id)
        Social::Slice["repositories.block_repository"]
          .bidirectionally_blocked_profile_ids(profile_id: profile_id)
      end
    end
  end
end
