# frozen_string_literal: true

require "concerns/cursor_pagination"
require "gruf"
require "storage"
require_relative "../../../lib/grpc/authenticatable"
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

      def account_adapter
        @account_adapter ||= Post::Adapters::AccountAdapter.new
      end

      def block_adapter
        @block_adapter ||= Post::Adapters::BlockAdapter.new
      end

      def media_adapter
        @media_adapter ||= Post::Adapters::MediaAdapter.new
      end

      def get_blocked_user_ids
        return [] unless current_user_id

        block_adapter.blocked_ids(account_id: current_user_id)
      end
    end
  end
end
