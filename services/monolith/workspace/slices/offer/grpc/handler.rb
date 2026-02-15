# frozen_string_literal: true

require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Offer
  module Grpc
    # Base handler class for Offer gRPC services.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
    end
  end
end
