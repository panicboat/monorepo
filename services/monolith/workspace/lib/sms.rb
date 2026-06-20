# frozen_string_literal: true

require_relative "sms/adapter"
require_relative "sms/fake_adapter"

module Sms
  class << self
    # @return [Sms::Adapter]
    def adapter
      @adapter ||= default_adapter
    end

    # @param adapter [Sms::Adapter]
    def adapter=(adapter)
      @adapter = adapter
    end

    # Reset to env default.
    def reset!
      @adapter = nil
    end

    # @param phone_number [String]
    # @param body [String]
    def send(phone_number:, body:)
      adapter.send(phone_number: phone_number, body: body)
    end

    private

    def default_adapter
      if ENV.fetch("HANAMI_ENV", "development") == "test"
        FakeAdapter.new
      else
        # Required lazily so test/CI without aws creds don't load the SDK.
        require_relative "sms/sns_adapter"
        SnsAdapter.new
      end
    end
  end
end
