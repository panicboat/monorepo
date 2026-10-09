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

      def viewer_can_see_post
        @viewer_can_see_post ||= Social::Slice["use_cases.viewer_can_see_post"]
      end

      def find_readable_post(post_id)
        post = post_repo.find_by_id(post_id)
        return nil unless post
        return nil if post.visibility == "private" && post.author_profile_id != current_profile_id

        viewer_can_see_post.call(viewer_profile_id: current_profile_id, post: post) ? post : nil
      end

      def get_blocked_profile_ids
        return [] unless current_profile_id

        block_adapter.blocked_ids(profile_id: current_profile_id)
      end
    end
  end
end
