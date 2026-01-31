# frozen_string_literal: true

module SMS
  # Abstract base class for SMS services.
  # Implement #send_message in subclasses.
  #
  # Usage:
  #   sms_service = SMS::MockAdapter.new
  #   sms_service.send_verification(phone_number: "+81901234567", code: "1234")
  #
  class Service
    # Send a verification code via SMS
    # @param phone_number [String] recipient phone number (E.164 format recommended)
    # @param code [String] verification code to send
    # @return [Hash] result with :success, :message_id, :error keys
    def send_verification(phone_number:, code:)
      message = verification_message(code)
      send_message(phone_number: phone_number, message: message)
    end

    # Send an SMS message
    # @param phone_number [String] recipient phone number
    # @param message [String] message body
    # @return [Hash] result with :success, :message_id, :error keys
    def send_message(phone_number:, message:)
      raise NotImplementedError, "Subclasses must implement #send_message"
    end

    private

    def verification_message(code)
      "【Nyx.PLACE】認証コード: #{code}\nこのコードは10分間有効です。"
    end
  end
end
