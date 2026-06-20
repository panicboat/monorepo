# frozen_string_literal: true

require "securerandom"
require "sms"

module Identity
  module UseCases
    module Verification
      class SendCode
        include Identity::Deps[repo: "repositories.sms_verification_repository"]

        CODE_TTL_SECONDS = 60 * 10

        def call(phone_number:)
          code = format("%06d", SecureRandom.random_number(1_000_000))
          expires_at = Time.now + CODE_TTL_SECONDS

          verification = repo.create(
            phone_number: phone_number,
            code: code,
            expires_at: expires_at
          )

          Sms.send(phone_number: phone_number, body: "認証コード: #{code}")

          verification
        end
      end
    end
  end
end
