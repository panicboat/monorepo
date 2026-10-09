# frozen_string_literal: true

module Karte
  module UseCases
    class AuthorizeCastAccess
      ROLE_CAST = 2

      def initialize(account_repo: nil, get_my_access: nil)
        @account_repo = account_repo
        @get_my_access = get_my_access
      end

      def call(viewer_account_id:)
        return false unless account_repo.find_by_id(viewer_account_id)&.role == ROLE_CAST

        get_my_access.call(viewer_account_id: viewer_account_id)[:has_access]
      end

      private

      def account_repo
        @account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def get_my_access
        @get_my_access ||= Karte::Slice["use_cases.get_my_access"]
      end
    end
  end
end
