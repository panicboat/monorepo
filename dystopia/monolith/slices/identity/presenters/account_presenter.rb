# frozen_string_literal: true

module Identity
  module Presenters
    class AccountPresenter
      ROLE_ENUM_TO_INT = {
        ROLE_UNSPECIFIED: 0,
        ROLE_GUEST: 1,
        ROLE_CAST: 2
      }.freeze
      ROLE_INT_TO_ENUM = ROLE_ENUM_TO_INT.invert.freeze

      def self.role_enum_to_int(enum)
        ROLE_ENUM_TO_INT[enum]
      end

      def self.role_int_to_enum(int)
        ROLE_INT_TO_ENUM[int] || :ROLE_UNSPECIFIED
      end

      def self.to_proto(account)
        Identity::V1::Account.new(
          id: account.id,
          role: role_int_to_enum(account.role),
          deactivated_at: account.deactivated_at && Google::Protobuf::Timestamp.new(seconds: account.deactivated_at.to_i)
        )
      end
    end
  end
end
