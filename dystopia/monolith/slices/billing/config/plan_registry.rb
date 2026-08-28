# frozen_string_literal: true

module Billing
  module Config
    class PlanRegistry
      class UnsupportedRoleError < StandardError; end

      ROLE_GUEST = 1
      ROLE_CAST = 2

      def initialize(guest_price_id:, cast_price_id:)
        @guest_price_id = guest_price_id
        @cast_price_id = cast_price_id
      end

      def price_id_for(role)
        case role
        when ROLE_GUEST then @guest_price_id
        when ROLE_CAST then @cast_price_id
        else
          raise UnsupportedRoleError, "role=#{role.inspect} has no billing plan"
        end
      end
    end
  end
end
