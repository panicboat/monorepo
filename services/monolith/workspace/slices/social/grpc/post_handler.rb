# frozen_string_literal: true

require "social/v1/post_service_services_pb"
require_relative "handler"

module Social
  module Grpc
    class PostHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "social.v1.PostService"

      bind ::Social::V1::PostService::Service

      self.rpc_descs.clear

      rpc :ListCastPosts, ::Social::V1::ListCastPostsRequest, ::Social::V1::ListCastPostsResponse
      rpc :GetCastPost, ::Social::V1::GetCastPostRequest, ::Social::V1::GetCastPostResponse
      rpc :SaveCastPost, ::Social::V1::SaveCastPostRequest, ::Social::V1::SaveCastPostResponse
      rpc :DeleteCastPost, ::Social::V1::DeleteCastPostRequest, ::Social::V1::DeleteCastPostResponse

      include Social::Deps[
        list_posts_uc: "use_cases.posts.list_posts",
        list_public_posts_uc: "use_cases.posts.list_public_posts",
        get_post_uc: "use_cases.posts.get_post",
        save_post_uc: "use_cases.posts.save_post",
        delete_post_uc: "use_cases.posts.delete_post"
      ]

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

            # Get likes count and comments count for cast's own posts
            post_ids = result[:posts].map(&:id)
            likes_counts = like_repo.likes_count_batch(post_ids: post_ids)
            blocked_user_ids = get_blocked_user_ids
            comments_counts = comment_repo.comments_count_batch(post_ids: post_ids, exclude_user_ids: blocked_user_ids)

            posts_proto = result[:posts].map do |post|
              PostPresenter.to_proto(
                post,
                author: cast,
                likes_count: likes_counts[post.id] || 0,
                comments_count: comments_counts[post.id] || 0,
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

        # All filter: public posts from public casts + all posts from followed casts
        # This is the default for authenticated users on the "All" tab
        if filter == "all" && current_user_id
          guest = find_my_guest
          if guest
            result = list_all_posts(
              limit: limit,
              cursor: cursor,
              guest_id: guest.id,
              exclude_cast_ids: blocked_cast_ids
            )
            return build_list_response(result)
          end
        end

        # Following filter: get posts from followed casts (all posts, not just public)
        # Approved followers can see all posts from the casts they follow
        if filter == "following" && current_user_id
          guest = find_my_guest
          if guest
            following_cast_ids = follow_repo.following_cast_ids(guest_id: guest.id)
            result = list_following_posts(
              limit: limit,
              cursor: cursor,
              cast_ids: following_cast_ids,
              exclude_cast_ids: blocked_cast_ids
            )
            return build_list_response(result)
          end
        end

        # Favorites filter: get posts from favorited casts
        if filter == "favorites" && current_user_id
          guest = find_my_guest
          if guest
            favorite_cast_ids = favorite_repo.favorite_cast_ids(guest_id: guest.id)
            result = list_public_posts_with_cast_ids_filter(
              limit: limit,
              cursor: cursor,
              cast_ids: favorite_cast_ids,
              exclude_cast_ids: blocked_cast_ids
            )
            return build_list_response(result)
          end
        end

        # If cast_id is specified, check if viewer is an approved follower
        # Approved followers can see all posts, others see only public posts
        if !cast_id.empty? && current_user_id
          guest = find_my_guest
          if guest && follow_repo.following?(cast_id: cast_id, guest_id: guest.id)
            # Viewer is an approved follower, show all posts
            result = list_following_posts(
              limit: limit,
              cursor: cursor,
              cast_ids: [cast_id],
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

        # Check access permission using AccessPolicy
        unless access_policy.can_view_post?(
          post: result[:post],
          cast: result[:author],
          viewer_guest_id: guest&.id
        )
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found")
        end

        likes_count = like_repo.likes_count(post_id: result[:post].id)
        liked = guest ? like_repo.liked?(post_id: result[:post].id, guest_id: guest.id) : false
        blocked_user_ids = get_blocked_user_ids
        comments_count = comment_repo.comments_count(post_id: result[:post].id, exclude_user_ids: blocked_user_ids)

        ::Social::V1::GetCastPostResponse.new(
          post: PostPresenter.to_proto(
            result[:post],
            author: result[:author],
            likes_count: likes_count,
            comments_count: comments_count,
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
          visibility: request.message.visibility.empty? ? "public" : request.message.visibility,
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

      private

      SavePost = Social::UseCases::Posts::SavePost

      def list_public_posts_with_cast_ids_filter(limit:, cursor:, cast_ids:, exclude_cast_ids: nil)
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

      # List all posts for authenticated user's "All" tab.
      # Returns: public posts from public casts + all posts from followed casts
      def list_all_posts(limit:, cursor:, guest_id:, exclude_cast_ids: nil)
        decoded_cursor = decode_cursor(cursor)

        # Get public cast IDs and followed cast IDs
        public_cast_ids = cast_adapter.public_cast_ids
        followed_cast_ids = follow_repo.following_cast_ids(guest_id: guest_id)

        posts = post_repo.list_all_for_authenticated(
          public_cast_ids: public_cast_ids,
          followed_cast_ids: followed_cast_ids,
          limit: limit,
          cursor: decoded_cursor,
          exclude_cast_ids: exclude_cast_ids
        )

        has_more = posts.length > limit
        posts = posts.first(limit) if has_more

        next_cursor = if has_more && posts.any?
          last = posts.last
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        # Load authors for all posts
        author_cast_ids = posts.map(&:cast_id).uniq
        authors = load_authors(author_cast_ids)

        { posts: posts, next_cursor: next_cursor, has_more: has_more, authors: authors }
      end

      # List posts from followed casts (all posts, not just public).
      # Used for approved followers who can see all posts.
      def list_following_posts(limit:, cursor:, cast_ids:, exclude_cast_ids: nil)
        return { posts: [], next_cursor: nil, has_more: false, authors: {} } if cast_ids.empty?

        decoded_cursor = decode_cursor(cursor)
        posts = post_repo.list_all_by_cast_ids(
          cast_ids: cast_ids,
          limit: limit,
          cursor: decoded_cursor,
          exclude_cast_ids: exclude_cast_ids
        )

        has_more = posts.length > limit
        posts = posts.first(limit) if has_more

        next_cursor = if has_more && posts.any?
          last = posts.last
          encode_cursor(created_at: last.created_at.iso8601, id: last.id)
        end

        # Load authors for all posts
        author_cast_ids = posts.map(&:cast_id).uniq
        authors = load_authors(author_cast_ids)

        { posts: posts, next_cursor: next_cursor, has_more: has_more, authors: authors }
      end

      def build_list_response(result)
        guest = find_my_guest
        post_ids = result[:posts].map(&:id)

        # Get blocked user IDs for filtering comments count
        blocked_user_ids = get_blocked_user_ids

        # Get likes count, comments count, and liked status in batch
        likes_counts = like_repo.likes_count_batch(post_ids: post_ids)
        comments_counts = comment_repo.comments_count_batch(post_ids: post_ids, exclude_user_ids: blocked_user_ids)
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
