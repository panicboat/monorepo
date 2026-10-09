# frozen_string_literal: true

module Footprints
  module UseCases
    class GetUnreadCount
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(profile_id:)
        footprints_repo.count_unread(profile_id: profile_id)
      end
    end
  end
end
