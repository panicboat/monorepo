# frozen_string_literal: true

module Sms
  # Base adapter interface for SMS backends. Env-specific adapters
  # (SNS for real send, Fake for test) inherit from this.
  class Adapter
    # @param phone_number [String] E.164 destination
    # @param body [String] message text
    # @return [void]
    def send(phone_number:, body:)
      raise NotImplementedError, "#{self.class}#send must be implemented"
    end
  end
end
