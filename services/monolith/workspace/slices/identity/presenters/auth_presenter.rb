# frozen_string_literal: true

module Identity
  module Presenters
    class AuthPresenter
      def self.to_register_response(result)
        ::Identity::V1::RegisterResponse.new(
          access_token: result[:access_token],
          refresh_token: result[:refresh_token],
          user_profile: UserPresenter.to_proto(result[:user_profile])
        )
      end

      def self.to_login_response(result)
        ::Identity::V1::LoginResponse.new(
          access_token: result[:access_token],
          refresh_token: result[:refresh_token],
          user_profile: UserPresenter.to_proto(result[:user_profile])
        )
      end

      def self.to_refresh_response(result)
        ::Identity::V1::RefreshTokenResponse.new(
          access_token: result[:access_token],
          refresh_token: result[:refresh_token]
        )
      end
    end
  end
end
