# frozen_string_literal: true

module Messaging
  module UseCases
    class AuthorizeMessage
      ROLE_CAST = 2

      def initialize(user_repo: nil, follow_repo: nil)
        @user_repo = user_repo
        @follow_repo = follow_repo
      end

      def call(sender_id:, recipient_id:)
        sender = user_repo.find_by_id(sender_id)
        return true if sender&.role == ROLE_CAST

        follow = follow_repo.find(follower_id: sender_id, followee_id: recipient_id)
        !!(follow && follow.status == "approved")
      end

      private

      def user_repo
        @user_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end
    end
  end
end
