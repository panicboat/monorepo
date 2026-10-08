# frozen_string_literal: true

module Messaging
  module UseCases
    class GetTotalUnreadCount
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      def call(profile_id:)
        return 0 if profile_id.nil? || profile_id.to_s.empty?

        messaging_repo.total_unread_count(profile_id: profile_id)
      end
    end
  end
end
