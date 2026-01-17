require 'bcrypt'
require 'jwt'

module Identity
  module Operations
    class Register
      class RegistrationError < StandardError; end

      include Identity::Deps[
        repo: "repositories.user_repository",
        verification_repo: "repositories.sms_verification_repository",
        refresh_repo: "repositories.refresh_token_repository"
      ]

      def call(phone_number:, password:, verification_token:, role: 1)
        # 1. Verify Token
        verification = verification_repo.find_by_id(verification_token)

        # Security checks
        unless verification
          raise RegistrationError, "Invalid verification token"
        end
        if verification.phone_number != phone_number
          raise RegistrationError, "Phone number mismatch"
        end
        unless verification.verified_at
          raise RegistrationError, "Phone number not verified"
        end

        # 2. Hash Password
        password_digest = BCrypt::Password.create(password)

        # 3. Create User
        user = repo.create(
          phone_number: phone_number,
          password_digest: password_digest,
          role: role
        )

        # 4. JWT Generation
        payload = { sub: user.id, role: user.role, exp: Time.now.to_i + 3600 * 24 * 30 } # 30 days
        token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "pan1cb0at"), 'HS256')

        refresh_token = SecureRandom.hex(32)
        refresh_repo.create(token: refresh_token, user_id: user.id, expires_at: Time.now + 3600 * 24 * 30)

        # Return result
        { access_token: token, refresh_token: refresh_token, user_profile: { id: user.id, phone_number: user.phone_number, role: user.role } }
      end
    end
  end
end
