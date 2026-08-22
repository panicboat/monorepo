# frozen_string_literal: true

module Requests
  def self.included(base)
    base.include InstanceMethods
  end

  module InstanceMethods
    # Helper to mock Gruf controller request
    def mock_gruf_controller(controller_class, message:)
      service = controller_class.service_name
      method_key = "test_method"
      active_call = double("active_call")

      controller_class.new(
        method_key: method_key,
        service: service,
        active_call: active_call,
        message: message
      )
    end
  end
end
