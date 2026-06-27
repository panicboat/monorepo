# frozen_string_literal: true

require "securerandom"
require "sms"

module Identity
  module UseCases
    module Verification
      class SendCode
        class RateLimitError < StandardError; end

        include Identity::Deps[repo: "repositories.sms_verification_repository"]

        CODE_TTL_SECONDS = 60 * 10
        MIN_RESEND_INTERVAL_SECONDS = 60
        DAILY_SEND_LIMIT = 5
        DAILY_WINDOW_SECONDS = 60 * 60 * 24

        def call(phone_number:)
          now = Time.now

          recent = repo.recent_for(phone_number, since: now - DAILY_WINDOW_SECONDS)
          if recent.size >= DAILY_SEND_LIMIT
            raise RateLimitError, "Daily SMS send limit exceeded"
          end
          last = recent.max_by(&:created_at)
          if last && (now - last.created_at) < MIN_RESEND_INTERVAL_SECONDS
            raise RateLimitError, "Code already sent recently"
          end

          # Expire any active (unconsumed, unverified) verification so a stale
          # code from a previous send cannot be used after a resend.
          repo.invalidate_active(phone_number)

          code = format("%06d", SecureRandom.random_number(1_000_000))
          expires_at = now + CODE_TTL_SECONDS

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
