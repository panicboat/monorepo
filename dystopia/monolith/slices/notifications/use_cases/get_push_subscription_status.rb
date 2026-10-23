# frozen_string_literal: true

module Notifications
  module UseCases
    class GetPushSubscriptionStatus
      include Notifications::Deps[push_subscription_repo: "repositories.push_subscription_repository"]

      def call(profile_id:, endpoint:)
        push_subscription_repo.subscribed?(profile_id: profile_id, endpoint: endpoint.to_s)
      end
    end
  end
end
