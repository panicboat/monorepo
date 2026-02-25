# frozen_string_literal: true

require "errors/validation_error"

module Identity
  module UseCases
    module Verification
      class VerifyCode
        class VerificationError < StandardError; end

        include Identity::Deps[
          repo: "repositories.sms_verification_repository",
          contract: "contracts.verification.verify_code_contract"
        ]

        def call(phone_number:, code:)
          # 0. Input Validation
          validation = contract.call(phone_number: phone_number, code: code)
          raise Errors::ValidationError, validation.errors unless validation.success?

          verification = repo.find_latest_by_phone_number(phone_number)

          raise VerificationError, "Verification not found" unless verification
          raise VerificationError, "Code expired" if verification.expires_at < Time.now
          raise VerificationError, "Invalid code" if verification.code != code

          # Mark as verified
          repo.mark_as_verified(verification.id)

          # Return the verification ID as the token
          { success: true, verification_token: verification.id }
        end
      end
    end
  end
end
