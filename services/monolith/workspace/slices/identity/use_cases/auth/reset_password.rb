# frozen_string_literal: true

require "bcrypt"

module Identity
  module UseCases
    module Auth
      class ResetPassword
        class ResetError < StandardError; end

        include Identity::Deps[
          repo: "repositories.user_repository",
          verification_repo: "repositories.sms_verification_repository"
        ]

        def call(phone_number:, new_password:, verification_token:)
          verification = verification_repo.find_by_id(verification_token)
          raise ResetError, "Invalid verification token" unless verification
          raise ResetError, "Phone number mismatch" if verification.phone_number != phone_number
          raise ResetError, "Phone number not verified" unless verification.verified_at

          user = repo.find_by_phone_number(phone_number)
          raise ResetError, "User not found" unless user

          repo.update_password(
            user_id: user.id,
            password_digest: BCrypt::Password.create(new_password)
          )

          { success: true }
        end
      end
    end
  end
end
