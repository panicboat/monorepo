# frozen_string_literal: true

require "base64"
require "json"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../../post/adapters/cast_adapter"
require_relative "../../post/adapters/guest_adapter"

module Trust
  module Grpc
    # Base handler class for Trust gRPC services.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      protected

      def cast_adapter
        @cast_adapter ||= Post::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Post::Adapters::GuestAdapter.new
      end

      def find_my_cast
        return nil unless current_user_id

        cast_adapter.find_by_user_id(current_user_id)
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

      def decode_cursor(cursor)
        return nil if cursor.nil? || cursor.empty?

        parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
        { created_at: Time.parse(parsed["created_at"]) }
      rescue StandardError
        nil
      end

      def encode_cursor(data)
        Base64.urlsafe_encode64(JSON.generate(data), padding: false)
      end
    end
  end
end
