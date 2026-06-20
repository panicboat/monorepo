# frozen_string_literal: true

require_relative "adapter"

module Sms
  # Test/CI adapter: records messages in memory, never hits the network.
  class FakeAdapter < Adapter
    attr_reader :sent

    def initialize
      @sent = []
    end

    def send(phone_number:, body:)
      @sent << { phone_number: phone_number, body: body }
      nil
    end
  end
end
