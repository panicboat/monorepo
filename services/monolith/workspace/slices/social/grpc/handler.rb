# frozen_string_literal: true

require "social/v1/service_services_pb"
require "gruf"
require_relative "../../../lib/grpc/authenticatable"
require_relative "../adapters/cast_adapter"
require_relative "../adapters/guest_adapter"
require_relative "../adapters/user_adapter"

module Social
  module Grpc
    class Handler < ::Gruf::Controllers::Base
      include ::GRPC::GenericService
      include ::Grpc::Authenticatable

      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.TimelineService"

      bind ::Social::V1::TimelineService::Service

      self.rpc_descs.clear

      # Timeline RPCs
      rpc :ListCastPosts, ::Social::V1::ListCastPostsRequest, ::Social::V1::ListCastPostsResponse
      rpc :GetCastPost, ::Social::V1::GetCastPostRequest, ::Social::V1::GetCastPostResponse
      rpc :SaveCastPost, ::Social::V1::SaveCastPostRequest, ::Social::V1::SaveCastPostResponse
      rpc :DeleteCastPost, ::Social::V1::DeleteCastPostRequest, ::Social::V1::DeleteCastPostResponse

      # Like RPCs
      rpc :LikeCastPost, ::Social::V1::LikeCastPostRequest, ::Social::V1::LikeCastPostResponse
      rpc :UnlikeCastPost, ::Social::V1::UnlikeCastPostRequest, ::Social::V1::UnlikeCastPostResponse
      rpc :GetPostLikeStatus, ::Social::V1::GetPostLikeStatusRequest, ::Social::V1::GetPostLikeStatusResponse

      # Follow RPCs
      rpc :FollowCast, ::Social::V1::FollowCastRequest, ::Social::V1::FollowCastResponse
      rpc :UnfollowCast, ::Social::V1::UnfollowCastRequest, ::Social::V1::UnfollowCastResponse
      rpc :ListFollowing, ::Social::V1::ListFollowingRequest, ::Social::V1::ListFollowingResponse
      rpc :GetFollowStatus, ::Social::V1::GetFollowStatusRequest, ::Social::V1::GetFollowStatusResponse

      # Comment RPCs
      rpc :AddComment, ::Social::V1::AddCommentRequest, ::Social::V1::AddCommentResponse
      rpc :DeleteComment, ::Social::V1::DeleteCommentRequest, ::Social::V1::DeleteCommentResponse
      rpc :ListComments, ::Social::V1::ListCommentsRequest, ::Social::V1::ListCommentsResponse
      rpc :ListReplies, ::Social::V1::ListRepliesRequest, ::Social::V1::ListRepliesResponse

      # Block RPCs
      rpc :BlockUser, ::Social::V1::BlockUserRequest, ::Social::V1::BlockUserResponse
      rpc :UnblockUser, ::Social::V1::UnblockUserRequest, ::Social::V1::UnblockUserResponse
      rpc :ListBlocked, ::Social::V1::ListBlockedRequest, ::Social::V1::ListBlockedResponse
      rpc :GetBlockStatus, ::Social::V1::GetBlockStatusRequest, ::Social::V1::GetBlockStatusResponse

      include Social::Deps[
        list_posts_uc: "use_cases.posts.list_posts",
        list_public_posts_uc: "use_cases.posts.list_public_posts",
        get_post_uc: "use_cases.posts.get_post",
        save_post_uc: "use_cases.posts.save_post",
        delete_post_uc: "use_cases.posts.delete_post",
        like_post_uc: "use_cases.likes.like_post",
        unlike_post_uc: "use_cases.likes.unlike_post",
        get_like_status_uc: "use_cases.likes.get_like_status",
        follow_cast_uc: "use_cases.follows.follow_cast",
        unfollow_cast_uc: "use_cases.follows.unfollow_cast",
        list_following_uc: "use_cases.follows.list_following",
        get_follow_status_uc: "use_cases.follows.get_follow_status",
        like_repo: "repositories.like_repository",
        follow_repo: "repositories.follow_repository",
        comment_repo: "repositories.comment_repository",
        add_comment_uc: "use_cases.comments.add_comment",
        delete_comment_uc: "use_cases.comments.delete_comment",
        list_comments_uc: "use_cases.comments.list_comments",
        list_replies_uc: "use_cases.comments.list_replies",
        block_user_uc: "use_cases.blocks.block_user",
        unblock_user_uc: "use_cases.blocks.unblock_user",
        list_blocked_uc: "use_cases.blocks.list_blocked",
        get_block_status_uc: "use_cases.blocks.get_block_status",
        block_repo: "repositories.block_repository"
      ]

      # === Timeline ===

      def list_cast_posts
        cast_id = request.message.cast_id
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor
        filter = request.message.filter

        # If authenticated Cast user with no cast_id specified and no filter, return their own posts (including hidden)
        # Guest API passes filter="public" to force public timeline even for Cast users
        if current_user_id && cast_id.empty? && filter.empty?
          cast = find_my_cast # Note: no ! - returns nil if not found
          if cast
            result = list_posts_uc.call(
              cast_id: cast.id,
              limit: limit,
              cursor: cursor
            )

            # Get likes count for cast's own posts
            post_ids = result[:posts].map(&:id)
            likes_counts = like_repo.likes_count_batch(post_ids: post_ids)

            posts_proto = result[:posts].map do |post|
              PostPresenter.to_proto(
                post,
                author: cast,
                likes_count: likes_counts[post.id] || 0,
                liked: false # Cast viewing own posts doesn't need liked status
              )
            end

            return ::Social::V1::ListCastPostsResponse.new(
              posts: posts_proto,
              next_cursor: result[:next_cursor] || "",
              has_more: result[:has_more]
            )
          end
          # If user is not a Cast (e.g., Guest), fall through to public timeline
        end

        # Get blocked cast IDs for filtering
        blocked_cast_ids = get_blocked_cast_ids

        # Following filter: get posts from followed casts
        if filter == "following" && current_user_id
          guest = find_my_guest
          if guest
            following_cast_ids = follow_repo.following_cast_ids(guest_id: guest.id)
            result = list_public_posts_with_following_filter(
              limit: limit,
              cursor: cursor,
              cast_ids: following_cast_ids,
              exclude_cast_ids: blocked_cast_ids
            )
            return build_list_response(result)
          end
        end

        # Public timeline: list all visible posts (with optional cast_id filter)
        result = list_public_posts_uc.call(
          limit: limit,
          cursor: cursor,
          cast_id: cast_id.empty? ? nil : cast_id,
          exclude_cast_ids: blocked_cast_ids
        )

        build_list_response(result)
      end

      def get_cast_post
        result = get_post_uc.call(id: request.message.id)

        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
        end

        guest = find_my_guest
        likes_count = like_repo.likes_count(post_id: result[:post].id)
        liked = guest ? like_repo.liked?(post_id: result[:post].id, guest_id: guest.id) : false

        ::Social::V1::GetCastPostResponse.new(
          post: PostPresenter.to_proto(
            result[:post],
            author: result[:author],
            likes_count: likes_count,
            liked: liked
          )
        )
      end

      def save_cast_post
        authenticate_user!
        cast = find_my_cast!

        media_data = request.message.media.map do |m|
          { media_type: m.media_type, url: m.url, thumbnail_url: m.thumbnail_url }
        end

        hashtags = request.message.hashtags.to_a

        post = save_post_uc.call(
          cast_id: cast.id,
          id: request.message.id.empty? ? nil : request.message.id,
          content: request.message.content,
          media: media_data,
          visible: request.message.visible,
          hashtags: hashtags
        )

        ::Social::V1::SaveCastPostResponse.new(
          post: PostPresenter.to_proto(post, author: cast)
        )
      rescue SavePost::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def delete_cast_post
        authenticate_user!
        cast = find_my_cast!

        delete_post_uc.call(cast_id: cast.id, post_id: request.message.id)

        ::Social::V1::DeleteCastPostResponse.new
      end

      # === Like ===

      def like_cast_post
        authenticate_user!
        guest = find_my_guest!

        result = like_post_uc.call(
          post_id: request.message.post_id,
          guest_id: guest.id
        )

        ::Social::V1::LikeCastPostResponse.new(likes_count: result[:likes_count])
      rescue LikePost::PostNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
      end

      def unlike_cast_post
        authenticate_user!
        guest = find_my_guest!

        result = unlike_post_uc.call(
          post_id: request.message.post_id,
          guest_id: guest.id
        )

        ::Social::V1::UnlikeCastPostResponse.new(likes_count: result[:likes_count])
      rescue UnlikePost::PostNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
      end

      def get_post_like_status
        guest = find_my_guest
        post_ids = request.message.post_ids.to_a

        liked = if guest
          get_like_status_uc.call(post_ids: post_ids, guest_id: guest.id)
        else
          post_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Social::V1::GetPostLikeStatusResponse.new(liked: liked)
      end

      # === Follow ===

      def follow_cast
        authenticate_user!
        guest = find_my_guest!

        result = follow_cast_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Social::V1::FollowCastResponse.new(success: result[:success])
      end

      def unfollow_cast
        authenticate_user!
        guest = find_my_guest!

        result = unfollow_cast_uc.call(
          cast_id: request.message.cast_id,
          guest_id: guest.id
        )

        ::Social::V1::UnfollowCastResponse.new(success: result[:success])
      end

      def list_following
        authenticate_user!
        guest = find_my_guest!

        limit = request.message.limit.zero? ? 100 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_following_uc.call(
          guest_id: guest.id,
          limit: limit,
          cursor: cursor
        )

        ::Social::V1::ListFollowingResponse.new(
          cast_ids: result[:cast_ids],
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_follow_status
        guest = find_my_guest
        cast_ids = request.message.cast_ids.to_a

        following = if guest
          get_follow_status_uc.call(cast_ids: cast_ids, guest_id: guest.id)
        else
          cast_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Social::V1::GetFollowStatusResponse.new(following: following)
      end

      # === Comment ===

      def add_comment
        authenticate_user!

        media_data = request.message.media.map do |m|
          { media_type: m.media_type, url: m.url, thumbnail_url: m.thumbnail_url }
        end

        result = add_comment_uc.call(
          post_id: request.message.post_id,
          user_id: current_user_id,
          content: request.message.content,
          parent_id: request.message.parent_id.empty? ? nil : request.message.parent_id,
          media: media_data
        )

        # Get author info
        author = get_comment_author(current_user_id)

        ::Social::V1::AddCommentResponse.new(
          comment: CommentPresenter.to_proto(result[:comment], author: author),
          comments_count: result[:comments_count]
        )
      rescue AddComment::PostNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
      rescue AddComment::EmptyContentError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Content cannot be empty")
      rescue AddComment::ContentTooLongError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Content exceeds 1000 characters")
      rescue AddComment::TooManyMediaError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Maximum 3 media attachments allowed")
      rescue AddComment::ParentNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Parent comment not found")
      rescue AddComment::CannotReplyToReplyError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Cannot reply to a reply")
      rescue AddComment::CreateFailedError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INTERNAL, "Failed to create comment")
      end

      def delete_comment
        authenticate_user!

        result = delete_comment_uc.call(
          comment_id: request.message.comment_id,
          user_id: current_user_id
        )

        ::Social::V1::DeleteCommentResponse.new(comments_count: result[:comments_count])
      rescue DeleteComment::CommentNotFoundOrUnauthorizedError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Comment not found or unauthorized")
      end

      def list_comments
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        # Get blocked user IDs for filtering comments
        blocked_user_ids = get_blocked_user_ids

        result = list_comments_uc.call(
          post_id: request.message.post_id,
          limit: limit,
          cursor: cursor,
          exclude_user_ids: blocked_user_ids
        )

        ::Social::V1::ListCommentsResponse.new(
          comments: CommentPresenter.many_to_proto(result[:comments], authors: result[:authors]),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def list_replies
        limit = request.message.limit.zero? ? 20 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        # Get blocked user IDs for filtering replies
        blocked_user_ids = get_blocked_user_ids

        result = list_replies_uc.call(
          comment_id: request.message.comment_id,
          limit: limit,
          cursor: cursor,
          exclude_user_ids: blocked_user_ids
        )

        ::Social::V1::ListRepliesResponse.new(
          replies: CommentPresenter.many_to_proto(result[:replies], authors: result[:authors]),
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      # === Block ===

      def block_user
        authenticate_user!
        blocker = find_blocker!

        result = block_user_uc.call(
          blocker_id: blocker[:id],
          blocker_type: blocker[:type],
          blocked_id: request.message.blocked_id,
          blocked_type: request.message.blocked_type
        )

        ::Social::V1::BlockUserResponse.new(success: result[:success])
      end

      def unblock_user
        authenticate_user!
        blocker = find_blocker!

        result = unblock_user_uc.call(
          blocker_id: blocker[:id],
          blocked_id: request.message.blocked_id
        )

        ::Social::V1::UnblockUserResponse.new(success: result[:success])
      end

      def list_blocked
        authenticate_user!
        blocker = find_blocker!

        limit = request.message.limit.zero? ? 50 : request.message.limit
        cursor = request.message.cursor.empty? ? nil : request.message.cursor

        result = list_blocked_uc.call(
          blocker_id: blocker[:id],
          limit: limit,
          cursor: cursor
        )

        users = result[:users].map do |user|
          ::Social::V1::BlockedUser.new(
            id: user[:id],
            user_type: user[:user_type],
            name: user[:name],
            image_url: user[:image_url] || "",
            blocked_at: user[:blocked_at]
          )
        end

        ::Social::V1::ListBlockedResponse.new(
          users: users,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end

      def get_block_status
        blocker = find_blocker
        user_ids = request.message.user_ids.to_a

        blocked = if blocker
          get_block_status_uc.call(user_ids: user_ids, blocker_id: blocker[:id])
        else
          user_ids.each_with_object({}) { |id, h| h[id] = false }
        end

        ::Social::V1::GetBlockStatusResponse.new(blocked: blocked)
      end

      private

      PostPresenter = Social::Presenters::PostPresenter
      CommentPresenter = Social::Presenters::CommentPresenter
      SavePost = Social::UseCases::Posts::SavePost
      LikePost = Social::UseCases::Likes::LikePost
      UnlikePost = Social::UseCases::Likes::UnlikePost
      AddComment = Social::UseCases::Comments::AddComment
      DeleteComment = Social::UseCases::Comments::DeleteComment

      def cast_adapter
        @cast_adapter ||= Social::Adapters::CastAdapter.new
      end

      def guest_adapter
        @guest_adapter ||= Social::Adapters::GuestAdapter.new
      end

      def user_adapter
        @user_adapter ||= Social::Adapters::UserAdapter.new
      end

      def get_comment_author(user_id)
        user_type = user_adapter.get_user_type(user_id)
        return nil unless user_type

        if user_type == "cast"
          cast = cast_adapter.find_by_user_id(user_id)
          if cast
            {
              id: cast.id,
              name: cast.name,
              image_url: cast.image_url,
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
              image_url: guest.avatar_path ? "https://cdn.nyx.place/#{guest.avatar_path}" : nil,
              user_type: "guest"
            }
          else
            # Guest profile not found, return minimal info
            { id: user_id, name: "Guest", image_url: nil, user_type: "guest" }
          end
        end
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

      def list_public_posts_with_following_filter(limit:, cursor:, cast_ids:, exclude_cast_ids: nil)
        return { posts: [], next_cursor: nil, has_more: false, authors: {} } if cast_ids.empty?

        # Use existing use case with filtering
        list_public_posts_uc.call(
          limit: limit,
          cursor: cursor,
          cast_id: nil,
          cast_ids: cast_ids,
          exclude_cast_ids: exclude_cast_ids
        )
      end

      def build_list_response(result)
        guest = find_my_guest
        post_ids = result[:posts].map(&:id)

        # Get likes count, comments count, and liked status in batch
        likes_counts = like_repo.likes_count_batch(post_ids: post_ids)
        comments_counts = comment_repo.comments_count_batch(post_ids: post_ids)
        liked_status = guest ? like_repo.liked_status_batch(post_ids: post_ids, guest_id: guest.id) : {}

        posts_with_authors = result[:posts].map do |post|
          author = result[:authors][post.cast_id]
          PostPresenter.to_proto(
            post,
            author: author,
            likes_count: likes_counts[post.id] || 0,
            comments_count: comments_counts[post.id] || 0,
            liked: liked_status[post.id] || false
          )
        end

        ::Social::V1::ListCastPostsResponse.new(
          posts: posts_with_authors,
          next_cursor: result[:next_cursor] || "",
          has_more: result[:has_more]
        )
      end
    end
  end
end
