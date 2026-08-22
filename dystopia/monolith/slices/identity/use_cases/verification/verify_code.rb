# frozen_string_literal: true

require "errors/validation_error"
require "rack/utils"

module Identity
  module UseCases
    module Verification
      class VerifyCode
        class VerificationError < StandardError; end

        MAX_FAILED_ATTEMPTS = 5

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
          raise VerificationError, "Too many attempts" if verification.failed_attempts >= MAX_FAILED_ATTEMPTS

          unless Rack::Utils.secure_compare(verification.code, code)
            repo.increment_failed_attempts(verification.id)
            if verification.failed_attempts + 1 >= MAX_FAILED_ATTEMPTS
              repo.invalidate(verification.id)
              raise VerificationError, "Too many attempts"
            end
            raise VerificationError, "Invalid code"
          end

          # Mark as verified
          repo.mark_as_verified(verification.id)

          # Return the verification ID as the token
          { success: true, verification_token: verification.id }
        end
      end
    end
  end
end
