module Identity
  module Services
    class VerifySms
      include Identity::Deps[repo: "repositories.sms_verification_repository"]

      class VerificationError < StandardError; end

      def call(phone_number:, code:)
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
