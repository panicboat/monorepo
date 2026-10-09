# frozen_string_literal: true

module Karte
  module UseCases
    class AuthorizeCastAccess
      ROLE_CAST = 2

      def initialize(get_role: nil, get_my_access: nil)
        @get_role = get_role
        @get_my_access = get_my_access
      end

      def call(viewer_account_id:)
        return false unless get_role.call(profile_id: viewer_account_id) == ROLE_CAST

        get_my_access.call(viewer_account_id: viewer_account_id)[:has_access]
      end

      private

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end

      def get_my_access
        @get_my_access ||= Karte::Slice["use_cases.get_my_access"]
      end
    end
  end
end
