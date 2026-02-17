# frozen_string_literal: true

require "base64"
require "json"
require "gruf"
require "storage"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../../post/adapters/cast_adapter"
require_relative "../../post/adapters/guest_adapter"
require_relative "../../post/adapters/user_adapter"

module Relationship
  module Grpc
    # Base handler class for Relationship gRPC services.
    # Provides shared functionality for all relationship handlers.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      include Relationship::Deps[
        follow_repo: "repositories.follow_repository",
        block_repo: "repositories.block_repository",
        favorite_repo: "repositories.favorite_repository"
      ]

      protected

      def cast_adapter
        @cast_adapter ||= Post::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Post::Adapters::GuestAdapter.new
      end

      def user_adapter
        @user_adapter ||= Post::Adapters::UserAdapter.new
      end

      def find_my_cast
        return nil unless current_user_id

        cast_adapter.find_by_user_id(current_user_id)
      end

      def find_my_cast!
        cast = find_my_cast
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast profile not found")
        end
        cast
      end

      def find_my_guest
        return nil unless current_user_id

        guest_adapter.find_by_user_id(current_user_id)
      end

      def find_my_guest!
        guest = find_my_guest
        unless guest
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Guest profile not found")
        end
        guest
      end

      def find_blocker
        return nil unless current_user_id

        guest = find_my_guest
        return { id: guest.id, type: "guest" } if guest

        cast = find_my_cast
        return { id: cast.id, type: "cast" } if cast

        nil
      end

      def find_blocker!
        blocker = find_blocker
        unless blocker
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "User profile not found")
        end
        blocker
      end

      def decode_cursor(cursor)
        return nil if cursor.nil? || cursor.empty?

        parsed = JSON.parse(Base64.urlsafe_decode64(cursor))
        { created_at: Time.parse(parsed["created_at"]), id: parsed["id"] }
      rescue StandardError
        nil
      end

      def encode_cursor(data)
        Base64.urlsafe_encode64(JSON.generate(data), padding: false)
      end
    end
  end
end
