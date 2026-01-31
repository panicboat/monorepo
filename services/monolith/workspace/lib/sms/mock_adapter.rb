# frozen_string_literal: true

require_relative "service"

module SMS
  # Mock SMS adapter for development and testing.
  # Logs messages to stdout instead of sending real SMS.
  #
  # Usage:
  #   adapter = SMS::MockAdapter.new
  #   adapter.send_verification(phone_number: "+81901234567", code: "1234")
  #
  class MockAdapter < Service
    attr_reader :sent_messages

    def initialize
      @sent_messages = []
    end

    # Send an SMS message (mock implementation)
    # @param phone_number [String] recipient phone number
    # @param message [String] message body
    # @return [Hash] result with :success, :message_id
    def send_message(phone_number:, message:)
      message_id = "mock_#{SecureRandom.hex(8)}"

      @sent_messages << {
        phone_number: phone_number,
        message: message,
        message_id: message_id,
        sent_at: Time.now
      }

      puts "[SMS MOCK] To: #{phone_number}"
      puts "[SMS MOCK] Message: #{message}"
      puts "[SMS MOCK] ID: #{message_id}"

      { success: true, message_id: message_id, error: nil }
    end

    # Clear sent messages (useful for tests)
    def clear!
      @sent_messages.clear
    end

    # Find messages sent to a specific phone number (useful for tests)
    def messages_to(phone_number)
      @sent_messages.select { |m| m[:phone_number] == phone_number }
    end
  end
end
