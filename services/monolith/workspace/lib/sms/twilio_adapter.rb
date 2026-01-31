# frozen_string_literal: true

require_relative "service"

module SMS
  # Twilio SMS adapter (stub implementation).
  # Requires twilio-ruby gem and configuration.
  #
  # Configuration (via environment variables):
  #   TWILIO_ACCOUNT_SID - Twilio Account SID
  #   TWILIO_AUTH_TOKEN  - Twilio Auth Token
  #   TWILIO_FROM_NUMBER - Sender phone number
  #
  # Usage:
  #   adapter = SMS::TwilioAdapter.new
  #   adapter.send_verification(phone_number: "+81901234567", code: "1234")
  #
  class TwilioAdapter < Service
    def initialize(
      account_sid: ENV.fetch("TWILIO_ACCOUNT_SID", nil),
      auth_token: ENV.fetch("TWILIO_AUTH_TOKEN", nil),
      from_number: ENV.fetch("TWILIO_FROM_NUMBER", nil)
    )
      @account_sid = account_sid
      @auth_token = auth_token
      @from_number = from_number
    end

    # Send an SMS message via Twilio
    # @param phone_number [String] recipient phone number (E.164 format)
    # @param message [String] message body
    # @return [Hash] result with :success, :message_id, :error keys
    def send_message(phone_number:, message:)
      validate_configuration!

      # TODO: Implement actual Twilio integration
      # require 'twilio-ruby'
      # client = Twilio::REST::Client.new(@account_sid, @auth_token)
      # result = client.messages.create(
      #   from: @from_number,
      #   to: phone_number,
      #   body: message
      # )
      # { success: true, message_id: result.sid, error: nil }

      raise NotImplementedError, "Twilio integration not yet implemented. Add twilio-ruby gem and uncomment the code above."
    rescue StandardError => e
      { success: false, message_id: nil, error: e.message }
    end

    private

    def validate_configuration!
      missing = []
      missing << "TWILIO_ACCOUNT_SID" if @account_sid.nil? || @account_sid.empty?
      missing << "TWILIO_AUTH_TOKEN" if @auth_token.nil? || @auth_token.empty?
      missing << "TWILIO_FROM_NUMBER" if @from_number.nil? || @from_number.empty?

      return if missing.empty?

      raise ArgumentError, "Missing Twilio configuration: #{missing.join(', ')}"
    end
  end
end
