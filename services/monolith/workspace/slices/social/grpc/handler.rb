# frozen_string_literal: true

require "base64"
require "json"
require "gruf"
require "storage"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../adapters/cast_adapter"
require_relative "../adapters/guest_adapter"
require_relative "../adapters/user_adapter"

module Social
  module Grpc
    # Base handler class for Social gRPC services.
    # Provides shared functionality for all social handlers.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      include Social::Deps[
        post_repo: "repositories.post_repository",
        like_repo: "repositories.like_repository",
        follow_repo: "repositories.follow_repository",
        comment_repo: "repositories.comment_repository",
        block_repo: "repositories.block_repository",
        favorite_repo: "repositories.favorite_repository",
        access_policy: "policies.access_policy"
      ]

      protected

      PostPresenter = Social::Presenters::PostPresenter
      CommentPresenter = Social::Presenters::CommentPresenter

      def cast_adapter
        @cast_adapter ||= Social::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Social::Adapters::GuestAdapter.new
      end

      def user_adapter
        @user_adapter ||= Social::Adapters::UserAdapter.new
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

      def get_blocked_cast_ids
        blocker = find_blocker
        return [] unless blocker

        block_repo.blocked_cast_ids(blocker_id: blocker[:id])
      end

      def get_blocked_user_ids
        blocker = find_blocker
        return [] unless blocker

        # Get blocked profile IDs grouped by type
        blocked_cast_ids = block_repo.blocked_cast_ids(blocker_id: blocker[:id])
        blocked_guest_ids = block_repo.blocked_guest_ids(blocker_id: blocker[:id])

        # Convert profile IDs to user IDs
        user_ids = []
        user_ids += cast_adapter.get_user_ids_by_cast_ids(blocked_cast_ids) unless blocked_cast_ids.empty?
        user_ids += guest_adapter.get_user_ids_by_guest_ids(blocked_guest_ids) unless blocked_guest_ids.empty?
        user_ids
      end

      def get_comment_author(user_id)
        user_type = user_adapter.get_user_type(user_id)
        return nil unless user_type

        if user_type == "cast"
          cast = cast_adapter.find_by_user_id(user_id)
          if cast
            # Use avatar_path if available, otherwise fall back to image_path
            image_key = cast.avatar_path.to_s.empty? ? cast.image_path : cast.avatar_path
            {
              id: cast.id,
              name: cast.name,
              image_url: Storage.download_url(key: image_key),
              user_type: "cast"
            }
          else
            # Cast profile not found, return minimal info
            { id: user_id, name: "Anonymous Cast", image_url: nil, user_type: "cast" }
          end
        else
          guest = guest_adapter.find_by_user_id(user_id)
          if guest
            {
              id: guest.id,
              name: guest.name,
              image_url: Storage.download_url(key: guest.avatar_path),
              user_type: "guest"
            }
          else
            # Guest profile not found, return minimal info
            { id: user_id, name: "Guest", image_url: nil, user_type: "guest" }
          end
        end
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

      def load_authors(cast_ids)
        return {} if cast_ids.empty?

        adapter = Social::Adapters::CastAdapter.new
        adapter.find_by_cast_ids(cast_ids)
      end
    end
  end
end
