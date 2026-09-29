# frozen_string_literal: true

module Karte
  module UseCases
    class AuthorizeCastAccess
      ROLE_CAST = 2

      def initialize(user_repo: nil, get_my_access: nil)
        @user_repo = user_repo
        @get_my_access = get_my_access
      end

      # Karte access is cast-only, gated separately by the billing flag in GetMyAccess.
      def call(viewer_account_id:)
        viewer = user_repo.find_by_id(viewer_account_id)
        return false unless viewer&.role == ROLE_CAST

        get_my_access.call(viewer_account_id: viewer_account_id)[:has_access]
      end

      private

      def user_repo
        @user_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def get_my_access
        @get_my_access ||= Karte::Slice["use_cases.get_my_access"]
      end
    end
  end
end
