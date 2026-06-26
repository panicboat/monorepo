# frozen_string_literal: true

require 'bcrypt'
require "auth/jwt_codec"
require "errors/validation_error"

module Identity
  module UseCases
    module Auth
      class Login
        MAX_FAILED_LOGIN_ATTEMPTS = 5
        LOCKOUT_DURATION_SECONDS = 60 * 15

        include Identity::Deps[
          repo: "repositories.user_repository",
          refresh_repo: "repositories.refresh_token_repository",
          contract: "contracts.auth.login_contract"
        ]

        def call(phone_number:, password:, role: nil)
          # 0. Input Validation
          params = { phone_number: phone_number, password: password }
          params[:role] = role unless role.nil?

          validation = contract.call(params)
          raise Errors::ValidationError, validation.errors unless validation.success?
          user = repo.find_by_phone_number(phone_number)

          return nil unless user
          return nil if user.locked_until && user.locked_until > Time.now

          unless BCrypt::Password.new(user.password_digest) == password
            repo.record_failed_login(user.id)
            if user.failed_login_attempts + 1 >= MAX_FAILED_LOGIN_ATTEMPTS
              repo.lock_until(user.id, Time.now + LOCKOUT_DURATION_SECONDS)
            end
            return nil
          end

          # Strict Role Enforcement
          if role && user.role != role
            return nil
          end

          repo.reset_login_attempts(user.id)

          token = ::Auth::JwtCodec.encode(sub: user.id, role: user.role)

          refresh_token = SecureRandom.hex(32)
          refresh_repo.create(token: refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 60)

          { access_token: token, refresh_token: refresh_token, account: { id: user.id, phone_number: user.phone_number, role: user.role } }
        end
      end
    end
  end
end
