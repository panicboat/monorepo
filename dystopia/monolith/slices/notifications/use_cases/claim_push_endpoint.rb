# frozen_string_literal: true

module Notifications
  module UseCases
    class ClaimPushEndpoint
      include Notifications::Deps[push_subscription_repo: "repositories.push_subscription_repository"]

      def call(account_id:, endpoint:)
        push_subscription_repo.release_endpoint(account_id: account_id, endpoint: endpoint.to_s)
        nil
      end
    end
  end
end
