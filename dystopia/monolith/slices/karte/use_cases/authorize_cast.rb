# frozen_string_literal: true

module Karte
  module UseCases
    class AuthorizeCast
      ROLE_CAST = 2

      def initialize(account_repo: nil)
        @account_repo = account_repo
      end

      def call(viewer_account_id:)
        return false unless Ids.valid?(viewer_account_id)

        account_repo.find_by_id(viewer_account_id)&.role == ROLE_CAST
      end

      private

      def account_repo
        @account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
    end
  end
end
