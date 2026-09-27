# frozen_string_literal: true

module Footprints
  module UseCases
    class GetUnreadCount
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(account_id:)
        footprints_repo.count_unread(account_id: account_id)
      end
    end
  end
end
