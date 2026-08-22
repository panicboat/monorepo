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

        # Raised when the user record is in a brute-force lockout window.
        # Carries the remaining seconds so callers can show a precise wait time.
        class LockedError < StandardError
          attr_reader :retry_after_seconds, :locked_until
          def initialize(locked_until:)
            @locked_until = locked_until
            @retry_after_seconds = [(locked_until - Time.now).to_i, 0].max
            super("Account is temporarily locked")
          end
        end

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
          if user.locked_until && user.locked_until > Time.now
            raise LockedError.new(locked_until: user.locked_until)
          end

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

          # Auto-reactivate if the account is in soft-deleted (deactivated) state.
          # Same-phone + correct password is treated as the user's intent to come back.
          reactivated = false
          if user.deactivated_at
            repo.reactivate(user.id)
            reactivated = true
          end

          token = ::Auth::JwtCodec.encode(sub: user.id, role: user.role)

          refresh_token = SecureRandom.hex(32)
          refresh_repo.create(token: refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 30)

          result = {
            access_token: token,
            refresh_token: refresh_token,
            account: { id: user.id, phone_number: user.phone_number, role: user.role }
          }
          result[:reactivated] = true if reactivated
          result
        end
      end
    end
  end
end
