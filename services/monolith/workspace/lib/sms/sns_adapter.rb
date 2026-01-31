# frozen_string_literal: true

require_relative "service"

module SMS
  # AWS SNS SMS adapter (stub implementation).
  # Requires aws-sdk-sns gem and configuration.
  #
  # Configuration (via environment variables):
  #   AWS_REGION            - AWS region (default: ap-northeast-1)
  #   AWS_ACCESS_KEY_ID     - AWS Access Key ID
  #   AWS_SECRET_ACCESS_KEY - AWS Secret Access Key
  #
  # Usage:
  #   adapter = SMS::SNSAdapter.new
  #   adapter.send_verification(phone_number: "+81901234567", code: "1234")
  #
  class SNSAdapter < Service
    def initialize(
      region: ENV.fetch("AWS_REGION", "ap-northeast-1"),
      sender_id: ENV.fetch("SNS_SENDER_ID", "NyxPLACE")
    )
      @region = region
      @sender_id = sender_id
    end

    # Send an SMS message via AWS SNS
    # @param phone_number [String] recipient phone number (E.164 format)
    # @param message [String] message body
    # @return [Hash] result with :success, :message_id, :error keys
    def send_message(phone_number:, message:)
      # TODO: Implement actual AWS SNS integration
      # require 'aws-sdk-sns'
      # client = Aws::SNS::Client.new(region: @region)
      # result = client.publish(
      #   phone_number: phone_number,
      #   message: message,
      #   message_attributes: {
      #     'AWS.SNS.SMS.SenderID' => {
      #       data_type: 'String',
      #       string_value: @sender_id
      #     },
      #     'AWS.SNS.SMS.SMSType' => {
      #       data_type: 'String',
      #       string_value: 'Transactional'
      #     }
      #   }
      # )
      # { success: true, message_id: result.message_id, error: nil }

      raise NotImplementedError, "AWS SNS integration not yet implemented. Add aws-sdk-sns gem and uncomment the code above."
    rescue StandardError => e
      { success: false, message_id: nil, error: e.message }
    end
  end
end
