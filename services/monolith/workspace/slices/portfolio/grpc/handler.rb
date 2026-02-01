# frozen_string_literal: true

require "gruf"
require_relative "../../../lib/grpc/authenticatable"

module Portfolio
  module Grpc
    # Base handler class for Portfolio gRPC services.
    # Provides shared functionality for CastHandler and GuestHandler.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      include Portfolio::Deps[
        get_upload_url_uc: "use_cases.images.get_upload_url"
      ]

      protected

      # Handle upload URL generation for any service.
      # @param prefix [String] 'casts' or 'guests'
      def handle_upload_url(prefix:)
        authenticate_user!

        result = get_upload_url_uc.call(
          user_id: current_user_id,
          filename: request.message.filename,
          content_type: request.message.content_type,
          prefix: prefix
        )

        if result.success?
          data = result.value!
          ::Portfolio::V1::GetUploadUrlResponse.new(url: data[:url], key: data[:key])
        else
          fail!(:invalid_argument, "Invalid input")
        end
      end
    end
  end
end
