# frozen_string_literal: true

require "gruf"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../adapters/media_adapter"

module Profile
  module Grpc
    # Base handler class for Profile gRPC services.
    # Provides shared functionality for CastHandler and GuestHandler.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      protected

      def media_adapter
        @media_adapter ||= Profile::Adapters::MediaAdapter.new
      end
    end
  end
end
