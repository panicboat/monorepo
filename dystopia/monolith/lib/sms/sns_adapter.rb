# frozen_string_literal: true

require "aws-sdk-sns"
require_relative "adapter"

module Sms
  # Sends SMS via Amazon SNS. Region/credentials resolve through the standard
  # AWS SDK chain (ENV / IAM role). Transactional SMS type for OTP delivery.
  class SnsAdapter < Adapter
    def initialize(client: nil)
      @client = client || Aws::SNS::Client.new
    end

    def send(phone_number:, body:)
      @client.publish(
        phone_number: phone_number,
        message: body,
        message_attributes: {
          "AWS.SNS.SMS.SMSType" => { data_type: "String", string_value: "Transactional" }
        }
      )
      nil
    end
  end
end
