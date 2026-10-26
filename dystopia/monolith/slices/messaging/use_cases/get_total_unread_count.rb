# frozen_string_literal: true

module Messaging
  module UseCases
    class GetTotalUnreadCount
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      def call(profile_id:)
        return 0 if profile_id.nil? || profile_id.to_s.empty?

        counterpart_ids = messaging_repo.counterpart_profile_ids(profile_id: profile_id)
        visible_ids = list_visible_profile_ids.call(profile_ids: counterpart_ids)
        messaging_repo.total_unread_count(profile_id: profile_id, sender_profile_ids: visible_ids)
      end

      private

      def list_visible_profile_ids
        @list_visible_profile_ids ||= Profile::Slice["use_cases.list_visible_profile_ids"]
      end
    end
  end
end
