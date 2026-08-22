# frozen_string_literal: true

require "bookmarks/v1/bookmark_service_services_pb"
require_relative "handler"

module Bookmarks
  module Grpc
    class BookmarkHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "bookmarks.v1.BookmarkService"

      bind ::Bookmarks::V1::BookmarkService::Service

      self.rpc_descs.clear

      rpc :Bookmark, ::Bookmarks::V1::BookmarkRequest, ::Bookmarks::V1::BookmarkResponse
      rpc :Unbookmark, ::Bookmarks::V1::UnbookmarkRequest, ::Bookmarks::V1::UnbookmarkResponse
      rpc :ListBookmarks, ::Bookmarks::V1::ListBookmarksRequest, ::Bookmarks::V1::ListBookmarksResponse
      rpc :GetBookmarkStatus, ::Bookmarks::V1::GetBookmarkStatusRequest, ::Bookmarks::V1::GetBookmarkStatusResponse

      include Bookmarks::Deps[
        bookmark_uc: "use_cases.bookmark",
        unbookmark_uc: "use_cases.unbookmark",
        list_bookmarks_uc: "use_cases.list_bookmarks",
        get_bookmark_status_uc: "use_cases.get_bookmark_status"
      ]

      def bookmark
        authenticate_user!
        bookmark_uc.call(account_id: current_user_id, post_id: request.message.post_id)
        ::Bookmarks::V1::BookmarkResponse.new
      end

      def unbookmark
        authenticate_user!
        unbookmark_uc.call(account_id: current_user_id, post_id: request.message.post_id)
        ::Bookmarks::V1::UnbookmarkResponse.new
      end

      def list_bookmarks
        authenticate_user!
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_bookmarks_uc.call(account_id: current_user_id, limit: limit, cursor: cursor)
        ::Bookmarks::V1::ListBookmarksResponse.new(
          posts: result[:posts],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_bookmark_status
        authenticate_user!
        statuses = get_bookmark_status_uc.call(
          account_id: current_user_id,
          post_ids: request.message.post_ids.to_a
        )
        ::Bookmarks::V1::GetBookmarkStatusResponse.new(bookmarked: statuses)
      end
    end
  end
end
