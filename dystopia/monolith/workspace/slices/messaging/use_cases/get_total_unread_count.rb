# frozen_string_literal: true

module Messaging
  module UseCases
    # Sum of unread messages across every thread the account participates in.
    # Drives the bottom-tab + drawer messaging badge (polling fallback for the
    # streaming-less path until M2 ships).
    class GetTotalUnreadCount
      include Messaging::Deps[messaging_repo: "repositories.messaging_repository"]

      def call(account_id:)
        return 0 if account_id.nil? || account_id.to_s.empty?

        messaging_repo.total_unread_count(account_id: account_id)
      end
    end
  end
end
