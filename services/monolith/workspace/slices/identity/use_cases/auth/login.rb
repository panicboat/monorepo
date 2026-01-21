# frozen_string_literal: true

require 'bcrypt'
require 'jwt'

module Identity
  module UseCases
    module Auth
      class Login
        class ValidationError < StandardError
          attr_reader :errors

          def initialize(errors)
            @errors = errors
            super(errors.to_h.to_s)
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
          raise ValidationError, validation.errors unless validation.success?
          user = repo.find_by_phone_number(phone_number)

          unless user && BCrypt::Password.new(user.password_digest) == password
            return nil
          end

          # Strict Role Enforcement
          if role && user.role != role
            return nil
          end

          payload = { sub: user.id, role: user.role, exp: Time.now.to_i + 3600 * 24 * 30 }
          token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "pan1cb0at"), 'HS256')

          refresh_token = SecureRandom.hex(32)
          refresh_repo.create(token: refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 30)

          { access_token: token, refresh_token: refresh_token, user_profile: { id: user.id, phone_number: user.phone_number, role: user.role } }
        end
      end
    end
  end
end
