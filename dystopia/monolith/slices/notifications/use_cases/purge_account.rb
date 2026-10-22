# frozen_string_literal: true

module Notifications
  module UseCases
    class PurgeAccount
      include Notifications::Deps[push_subscription_repo: "repositories.push_subscription_repository"]

      def call(account_id:)
        push_subscription_repo.delete_by_account(account_id)
        nil
      end
    end
  end
end
