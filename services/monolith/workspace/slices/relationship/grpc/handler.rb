# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require "storage"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../../post/adapters/cast_adapter"
require_relative "../../post/adapters/guest_adapter"
require_relative "../../post/adapters/user_adapter"
require_relative "../../post/adapters/media_adapter"

module Relationship
  module Grpc
    # Base handler class for Relationship gRPC services.
    # Provides shared functionality for all relationship handlers.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include Concerns::CursorPagination

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

      def media_adapter
        @media_adapter ||= Post::Adapters::MediaAdapter.new
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

      def find_blocker_by_type(blocker_type)
        # FALLBACK: When blocker_type is omitted, auto-detect from current user's profiles
        return find_blocker! if blocker_type.nil? || blocker_type.empty?

        case blocker_type
        when "cast"
          cast = find_my_cast!
          { id: cast.id, type: "cast" }
        when "guest"
          guest = find_my_guest!
          { id: guest.id, type: "guest" }
        else
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Invalid blocker_type: #{blocker_type}")
        end
      end

    end
  end
end
