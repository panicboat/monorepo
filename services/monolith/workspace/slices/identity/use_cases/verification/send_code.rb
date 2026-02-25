# frozen_string_literal: true

module Identity
  module UseCases
    module Verification
      class SendCode
        include Identity::Deps[repo: "repositories.sms_verification_repository"]

        def call(phone_number:)
          # TODO: Implement real SMS sending logic (e.g. via Twilio or SNS).
          # Currently using Mock SMS Logic: Always use "0000" or random 4 digits
          # FALLBACK: Fixed code "0000" for local development when MOCK_SMS_CODE env var is not set
          code = ENV.fetch("MOCK_SMS_CODE", "0000")
          expires_at = Time.now + (60 * 10) # 10 minutes

          verification = repo.create(
            phone_number: phone_number,
            code: code,
            expires_at: expires_at
          )

          # In a real app, call Twilio/SNS here.
          puts "[SMS MOCK] Sending code #{code} to #{phone_number}"

          verification
        end
      end
    end
  end
end
