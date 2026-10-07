# frozen_string_literal: true

module Messaging
  module UseCases
    class AuthorizeMessage
      ROLE_CAST = 2

      def initialize(get_role: nil, follow_repo: nil)
        @get_role = get_role
        @follow_repo = follow_repo
      end

      def call(sender_id:, recipient_id:)
        return true if get_role.call(profile_id: sender_id) == ROLE_CAST

        follow = follow_repo.find(follower_id: sender_id, followee_id: recipient_id)
        !!(follow && follow.status == "approved")
      end

      private

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
