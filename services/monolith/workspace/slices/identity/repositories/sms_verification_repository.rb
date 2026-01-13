module Identity
  module Repositories
    class SmsVerificationRepository < Identity::DB::Repo
      def create(phone_number:, code:, expires_at:)
        sms_verifications.command(:create).call(
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

      def mark_as_verified(id)
        sms_verifications
          .by_pk(id)
          .command(:update)
          .call(verified_at: Time.now)
      end

      def find_by_id(id)
        sms_verifications.by_pk(id).one
      end
    end
  end
end
