# frozen_string_literal: true

require "concerns/visible_page"
require "post/v1/post_service_services_pb"
require_relative "handler"

module Post
  module Grpc
    class PostHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "post.v1.PostService"

      bind ::Post::V1::PostService::Service

      self.rpc_descs.clear

      rpc :ListPosts, ::Post::V1::ListPostsRequest, ::Post::V1::ListPostsResponse
      rpc :GetPost, ::Post::V1::GetPostRequest, ::Post::V1::GetPostResponse
      rpc :SavePost, ::Post::V1::SavePostRequest, ::Post::V1::SavePostResponse
      rpc :DeletePost, ::Post::V1::DeletePostRequest, ::Post::V1::DeletePostResponse
      rpc :PinPost, ::Post::V1::PinPostRequest, ::Post::V1::PinPostResponse
      rpc :UnpinPost, ::Post::V1::UnpinPostRequest, ::Post::V1::UnpinPostResponse

      include Post::Concerns::ProfileAuthorResolvable
      include Post::Deps[
        create_post: "use_cases.create_post",
        discard_detached_media: "use_cases.discard_detached_media"
      ]

      AuthorRef = Struct.new(:author_profile_id)

      def list_posts
        limit = request.message.limit.zero? ? DEFAULT_LIMIT : request.message.limit
        cursor = request.message.cursor.empty? ? nil : decode_cursor(request.message.cursor, keys: [:published_at, :id])
        author_profile_id = request.message.author_profile_id.empty? ? nil : request.message.author_profile_id
        return ::Post::V1::ListPostsResponse.new(posts: [], next_cursor: "", has_more: false) if author_profile_id && !author_readable?(author_profile_id)

        live_only = author_profile_id.nil? || author_profile_id != current_profile_id
        include_private = author_profile_id ? followers_only_readable?(author_profile_id) : false
        pinned_first = !author_profile_id.nil? && !request.message.media_only
        page = ::Concerns::VisiblePage.fill(
          limit: limit,
          cursor: cursor,
          fetch: ->(after) { post_repo.list_posts(limit: limit, cursor: after, author_profile_id: author_profile_id, media_only: request.message.media_only, include_private: include_private, live_only: live_only, exclude_pinned: pinned_first) },
          keep: ->(rows) { filter_visible_posts.call(viewer_profile_id: current_profile_id, posts: rows) },
          cursor_of: ->(row) { { published_at: row.published_at, id: row.id } }
        )
        rows = page[:items]
        next_cursor = if page[:has_more] && rows.any?
          encode_cursor(published_at: rows.last.published_at.iso8601(6), id: rows.last.id)
        else
          ""
        end
        pinned = pinned_first && cursor.nil? ? visible_pinned_post(author_profile_id: author_profile_id, include_private: include_private, live_only: live_only) : nil

        ::Post::V1::ListPostsResponse.new(
          posts: present_posts([*pinned, *rows]),
          next_cursor: next_cursor,
          has_more: page[:has_more]
        )
      end

      def get_post
        post = find_readable_post(request.message.id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless post

        ::Post::V1::GetPostResponse.new(post: present_post(post))
      end

      def save_post
        authenticate_user!

        m = request.message
        result = create_post.call(
          author_profile_id: current_profile_id,
          content: m.content,
          visibility: m.visibility,
          media: m.media.map { |x| { media_id: x.media_id, media_type: x.media_type } },
          hashtags: m.hashtags.to_a,
          published_at: m.published_at,
          expires_at: m.expires_at,
          quoted_post_id: m.quoted_post_id
        )
        mentioned_usernames = mentioned_usernames_for(result[:mentions].map { |mention| mention[:profile_id] })

        ::Post::V1::SavePostResponse.new(post: present_post(result[:post], mentioned_usernames: mentioned_usernames))
      rescue UseCases::CreatePost::InvalidPostError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def delete_post
        authenticate_user!

        existing = post_repo.find_by_id_and_author(id: request.message.id, author_profile_id: current_profile_id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing

        media_ids = post_repo.media_ids_of(existing.id) + comment_repo.media_ids_on_post(existing.id)
        post_repo.delete_post(existing.id)
        discard_detached_media.call(ids: media_ids)
        ::Post::V1::DeletePostResponse.new
      end

      def pin_post
        authenticate_user!

        existing = post_repo.find_by_id_and_author(id: request.message.id, author_profile_id: current_profile_id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing

        post_repo.pin_post(id: existing.id, author_profile_id: current_profile_id)
        ::Post::V1::PinPostResponse.new
      end

      def unpin_post
        authenticate_user!

        existing = post_repo.find_by_id_and_author(id: request.message.id, author_profile_id: current_profile_id)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing

        post_repo.unpin_post(existing.id)
        ::Post::V1::UnpinPostResponse.new
      end

      private

      def visible_pinned_post(author_profile_id:, include_private:, live_only:)
        pinned = post_repo.find_pinned(author_profile_id: author_profile_id, include_private: include_private, live_only: live_only)
        return nil unless pinned

        filter_visible_posts.call(viewer_profile_id: current_profile_id, posts: [pinned]).first
      end

      def load_media_files_for_posts(posts)
        media_ids = posts.flat_map do |post|
          next [] unless post.respond_to?(:post_media)

          (post.post_media || []).filter_map(&:media_id)
        end.uniq

        return {} if media_ids.empty?

        media_adapter.find_by_ids(media_ids)
      end

      def present_posts(rows)
        post_ids = rows.map(&:id)
        blocked_profile_ids = get_blocked_profile_ids
        authors = summarize_profiles.call(profile_ids: rows.map(&:author_profile_id))
        likes_counts = like_repo.likes_count_batch(post_ids: post_ids, exclude_profile_ids: blocked_profile_ids)
        comments_counts = comment_repo.comments_count_batch(post_ids: post_ids, exclude_author_profile_ids: blocked_profile_ids)
        liked = current_profile_id ? like_repo.profile_liked_status_batch(post_ids: post_ids, profile_id: current_profile_id) : {}
        media_files = load_media_files_for_posts(rows)
        mentioned_usernames = mentioned_usernames_for(rows.flat_map { |p| p.post_mentions.map(&:profile_id) })
        schedules = schedule_adapter.find_by_post_ids(post_ids.map(&:to_s))

        rows.map do |post|
          PostPresenter.to_post_proto(
            post,
            author: authors[post.author_profile_id.to_s],
            likes_count: likes_counts[post.id] || 0,
            comments_count: comments_counts[post.id] || 0,
            liked: liked[post.id] || false,
            media_files: media_files,
            mentioned_usernames: mentioned_usernames,
            schedules: schedules
          )
        end
      end

      def present_post(post, mentioned_usernames: nil)
        blocked_profile_ids = get_blocked_profile_ids
        authors = summarize_profiles.call(profile_ids: [post.author_profile_id])
        likes_count = like_repo.likes_count(post_id: post.id, exclude_profile_ids: blocked_profile_ids)
        comments_count = comment_repo.comments_count(post_id: post.id, exclude_author_profile_ids: blocked_profile_ids)
        liked = current_profile_id ? like_repo.profile_liked?(post_id: post.id, profile_id: current_profile_id) : false
        media_files = load_media_files_for_posts([post])
        mentioned_usernames ||= mentioned_usernames_for(post.post_mentions.map(&:profile_id))
        schedules = schedule_adapter.find_by_post_ids([post.id.to_s])

        PostPresenter.to_post_proto(
          post,
          author: authors[post.author_profile_id.to_s],
          likes_count: likes_count,
          comments_count: comments_count,
          liked: liked,
          media_files: media_files,
          mentioned_usernames: mentioned_usernames,
          schedules: schedules
        )
      end

      def followers_only_readable?(author_profile_id)
        return true if author_profile_id == current_profile_id
        return false unless current_profile_id

        follow_repo.find(follower_profile_id: current_profile_id, followee_profile_id: author_profile_id)&.status == "approved"
      end

      def follow_repo
        @follow_repo ||= Social::Slice["repositories.follow_repository"]
      end

      def author_readable?(author_profile_id)
        filter_visible_posts.call(viewer_profile_id: current_profile_id, posts: [AuthorRef.new(author_profile_id)]).any?
      end

      def mentioned_usernames_for(profile_ids)
        ids = profile_ids.uniq
        return {} if ids.empty?

        summarize_profiles.call(profile_ids: ids).transform_values(&:username)
      end

      def filter_visible_posts
        @filter_visible_posts ||= Social::Slice["use_cases.filter_visible_posts"]
      end
    end
  end
end
