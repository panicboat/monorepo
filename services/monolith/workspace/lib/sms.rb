# frozen_string_literal: true

require_relative "sms/service"
require_relative "sms/mock_adapter"
require_relative "sms/twilio_adapter"
require_relative "sms/sns_adapter"

module SMS
  class << self
    # Get the configured SMS service instance
    # @return [SMS::Service] the configured SMS adapter
    def service
      @service ||= build_service
    end

    # Reset the service (useful for testing)
    def reset!
      @service = nil
    end

    # Set a custom service (useful for testing)
    def service=(svc)
      @service = svc
    end

    private

    def build_service
      adapter_name = ENV.fetch("SMS_ADAPTER", "mock").downcase

      case adapter_name
      when "twilio"
        TwilioAdapter.new
      when "sns"
        SNSAdapter.new
      else
        MockAdapter.new
      end
    end
  end
end
