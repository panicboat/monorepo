# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require "storage"
require_relative "../adapters/cast_adapter"
require_relative "../adapters/guest_adapter"
require_relative "../adapters/account_adapter"
require_relative "../adapters/block_adapter"
require_relative "../adapters/media_adapter"

module Post
  module Grpc
    # Base handler class for Post gRPC services.
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable
      include ::Concerns::CursorPagination

      include Post::Deps[
        post_repo: "repositories.post_repository",
        like_repo: "repositories.like_repository",
        comment_repo: "repositories.comment_repository"
      ]

      protected

      PostPresenter = Post::Presenters::PostPresenter
      CommentPresenter = Post::Presenters::CommentPresenter

      def cast_adapter
        @cast_adapter ||= Post::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Post::Adapters::GuestAdapter.new
      end

      def account_adapter
        @account_adapter ||= Post::Adapters::AccountAdapter.new
      end

      def block_adapter
        @block_adapter ||= Post::Adapters::BlockAdapter.new
      end

      def media_adapter
        @media_adapter ||= Post::Adapters::MediaAdapter.new
      end

      def find_my_cast
        return nil unless current_user_id

        cast_adapter.find_by_user_id(current_user_id)
      end

      def find_my_guest
        return nil unless current_user_id

        guest_adapter.find_by_user_id(current_user_id)
      end

      def find_blocker
        return nil unless current_user_id

        guest = find_my_guest
        return { id: guest.user_id, type: "guest" } if guest

        cast = find_my_cast
        return { id: cast.user_id, type: "cast" } if cast

        nil
      end

      def get_blocked_user_ids
        blocker = find_blocker
        return [] unless blocker

        block_adapter.blocked_ids(account_id: blocker[:id])
      end
    end
  end
end
