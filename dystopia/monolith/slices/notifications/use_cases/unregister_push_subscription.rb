# frozen_string_literal: true

module Notifications
  module UseCases
    class UnregisterPushSubscription
      include Notifications::Deps[push_subscription_repo: "repositories.push_subscription_repository"]

      def call(profile_id:, endpoint:)
        push_subscription_repo.delete_for_profile(profile_id: profile_id, endpoint: endpoint.to_s)
        nil
      end
    end
  end
end
