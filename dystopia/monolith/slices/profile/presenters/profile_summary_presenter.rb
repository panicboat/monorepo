# frozen_string_literal: true

module Profile
  module Presenters
    class ProfileSummaryPresenter
      def self.to_proto(summary)
        return nil unless summary

        ::Profile::V1::ProfileSummary.new(
          profile_id: summary.profile_id,
          username: summary.username,
          display_name: summary.display_name,
          avatar_url: summary.avatar_url,
          is_private: summary.is_private,
          role: summary.role
        )
      end
    end
  end
end
