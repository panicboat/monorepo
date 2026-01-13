module Identity
  module Services
    class VerifySms
      include Identity::Deps[repo: "repositories.sms_verification_repository"]

      def call(phone_number:, code:)
        verification = repo.find_latest_by_phone(phone_number)

        return { success: false } unless verification
        return { success: false } if verification.expires_at < Time.now
        return { success: false } if verification.code != code

        # Mark as verified
        repo.mark_as_verified(verification.id)

        # Return the verification ID as the token
        { success: true, verification_token: verification.id }
      end
    end
  end
end
