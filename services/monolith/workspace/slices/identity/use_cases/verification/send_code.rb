# frozen_string_literal: true

require "sms"

module Identity
  module UseCases
    module Verification
      class SendCode
        include Identity::Deps[repo: "repositories.sms_verification_repository"]

        CODE_LENGTH = 4
        CODE_EXPIRY_MINUTES = 10

        def call(phone_number:)
          code = generate_code
          expires_at = Time.now + (60 * CODE_EXPIRY_MINUTES)

          verification = repo.create(
            phone_number: phone_number,
            code: code,
            expires_at: expires_at
          )

          # Send SMS via configured adapter (mock/twilio/sns)
          result = sms_service.send_verification(phone_number: phone_number, code: code)

          unless result[:success]
            # Log the error but don't fail - verification record is still created
            puts "[SMS ERROR] Failed to send to #{phone_number}: #{result[:error]}"
          end

          verification
        end

        private

        def generate_code
          # Use fixed code in development/test if configured
          return ENV["MOCK_SMS_CODE"] if ENV["MOCK_SMS_CODE"]

          # Generate random 4-digit code
          format("%0#{CODE_LENGTH}d", SecureRandom.random_number(10**CODE_LENGTH))
        end

        def sms_service
          @sms_service ||= SMS.service
        end
      end
    end
  end
end
