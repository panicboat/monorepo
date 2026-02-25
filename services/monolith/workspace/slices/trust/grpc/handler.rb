# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../../post/adapters/cast_adapter"
require_relative "../../post/adapters/guest_adapter"
require_relative "../../post/adapters/media_adapter"

module Trust
  module Grpc
    # Base handler class for Trust gRPC services.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include Concerns::CursorPagination

      protected

      def cast_adapter
        @cast_adapter ||= Post::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Post::Adapters::GuestAdapter.new
      end

      def media_adapter
        @media_adapter ||= Post::Adapters::MediaAdapter.new
      end

      def find_my_cast
        return nil unless current_user_id

        cast_adapter.find_by_user_id(current_user_id)
      end

      def authenticate_cast!
        authenticate_user!

        cast = find_my_cast
        return cast if cast

        raise GRPC::BadStatus.new(
          GRPC::Core::StatusCodes::PERMISSION_DENIED,
          "Cast access required"
        )
      end

      def find_my_guest
        return nil unless current_user_id

        guest_adapter.find_by_user_id(current_user_id)
      end

      def determine_role!
        return :cast if find_my_cast
        return :guest if find_my_guest

        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
      end

    end
  end
end
