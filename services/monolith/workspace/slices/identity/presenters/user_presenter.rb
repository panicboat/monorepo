# frozen_string_literal: true

module Identity
  module Presenters
    class UserPresenter
      def self.to_proto(profile)
        return nil unless profile

        ::Identity::V1::UserProfile.new(
          id: profile[:id],
          phone_number: profile[:phone_number],
          role: role_int_to_enum(profile[:role])
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
