# frozen_string_literal: true

module Identity
  module Presenters
    class AccountPresenter
      def self.to_proto(account)
        return nil unless account

        ::Identity::V1::Account.new(
          id: account[:id],
          phone_number: account[:phone_number],
          role: role_int_to_enum(account[:role])
        )
      end

      def self.role_int_to_enum(role_int)
        case role_int
        when 2 then :ROLE_CAST
        else :ROLE_GUEST
        end
      end

      def self.role_enum_to_int(role_enum)
        case role_enum
        when :ROLE_CAST, 2 then 2
        when :ROLE_GUEST, 1 then 1
        else nil
        end
      end
    end
  end
end
