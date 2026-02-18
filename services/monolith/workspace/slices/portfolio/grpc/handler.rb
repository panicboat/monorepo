# frozen_string_literal: true

require "gruf"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../adapters/media_adapter"

module Portfolio
  module Grpc
    # Base handler class for Portfolio gRPC services.
    # Provides shared functionality for CastHandler and GuestHandler.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      protected

      def media_adapter
        @media_adapter ||= Portfolio::Adapters::MediaAdapter.new
      end
    end
  end
end
