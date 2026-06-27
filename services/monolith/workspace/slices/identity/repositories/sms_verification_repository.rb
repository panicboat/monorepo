module Identity
  module Repositories
    class SmsVerificationRepository < Identity::DB::Repo
      def create(phone_number:, code:, expires_at:)
        sms_verifications.command(:create).call(
          id: SecureRandom.uuid_v7,
          phone_number: phone_number,
          code: code,
          expires_at: expires_at
        )
      end

      def find_latest_by_phone_number(phone_number)
        sms_verifications
          .where(phone_number: phone_number)
          .order { created_at.desc }
          .limit(1)
          .one
      end

      def recent_for(phone_number, since:)
        sms_verifications
          .where(phone_number: phone_number)
          .where { created_at >= since }
          .to_a
      end

      def invalidate_active(phone_number)
        # Expire (but keep) any unverified/unconsumed verification so the stale
        # code cannot be verified, while preserving the row for send-rate accounting.
        sms_verifications
          .where(phone_number: phone_number)
          .where(verified_at: nil, consumed_at: nil)
          .dataset
          .update(expires_at: Time.now)
      end

      def mark_as_verified(id)
        sms_verifications
          .by_pk(id)
          .command(:update)
          .call(verified_at: Time.now)
      end

      def mark_as_consumed(id)
        sms_verifications
          .by_pk(id)
          .command(:update)
          .call(consumed_at: Time.now)
      end

      def increment_failed_attempts(id)
        sms_verifications
          .by_pk(id)
          .dataset
          .update(failed_attempts: Sequel[:failed_attempts] + 1)
      end

      def invalidate(id)
        sms_verifications
          .by_pk(id)
          .command(:update)
          .call(expires_at: Time.now)
      end

      def find_by_id(id)
        sms_verifications.by_pk(id).one
      end
    end
  end
end
