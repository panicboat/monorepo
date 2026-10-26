# frozen_string_literal: true

require "post/v1/post_service_services_pb"
require "text"
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

      include Post::Concerns::ProfileAuthorResolvable
      include Post::Deps[
        extract_mentions: "use_cases.extract_mentions",
        discard_detached_media: "use_cases.discard_detached_media"
      ]

      AuthorRef = Struct.new(:author_profile_id)

      def list_posts
        limit = request.message.limit.zero? ? DEFAULT_LIMIT : request.message.limit
        cursor = request.message.cursor.empty? ? nil : decode_cursor(request.message.cursor, keys: [:published_at, :id])
        author_profile_id = request.message.author_profile_id.empty? ? nil : request.message.author_profile_id
        return ::Post::V1::ListPostsResponse.new(posts: [], next_cursor: "", has_more: false) if author_profile_id && !author_readable?(author_profile_id)

        live_only = author_profile_id.nil? || author_profile_id != current_profile_id
        rows = post_repo.list_posts(limit: limit, cursor: cursor, author_profile_id: author_profile_id, media_only: request.message.media_only, include_private: author_profile_id ? followers_only_readable?(author_profile_id) : false, live_only: live_only)
        has_more = rows.length > limit
        rows = rows.first(limit) if has_more
        next_cursor = if has_more && rows.any?
          encode_cursor(published_at: rows.last.published_at.iso8601(6), id: rows.last.id)
        else
          ""
        end
        rows = filter_visible_posts.call(viewer_profile_id: current_profile_id, posts: rows)

        ::Post::V1::ListPostsResponse.new(
          posts: present_posts(rows),
          next_cursor: next_cursor,
          has_more: has_more
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
        content = m.content.to_s
        if Text.blank?(content)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "本文を入力してください")
        end
        visibility = m.visibility.empty? ? "public" : m.visibility
        unless %w[public private].include?(visibility)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "公開範囲が正しくありません")
        end
        media_data = m.media.map { |x| { media_id: x.media_id, media_type: x.media_type } }
        unless media_adapter.owned_all?(profile_id: current_profile_id, ids: media_data.map { |x| x[:media_id] })
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "添付できないメディアが含まれています")
        end
        hashtags = m.hashtags.to_a
        mentions = extract_mentions.call(content: content)
        is_create = m.id.empty?
        now = Time.now

        if is_create
          published_at, expires_at = display_window(m, now: now)
          post = post_repo.create_post(author_profile_id: current_profile_id, content: content, visibility: visibility, published_at: published_at, expires_at: expires_at)
        else
          existing = post_repo.find_by_id_and_author(id: m.id, author_profile_id: current_profile_id)
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Post not found") unless existing
          published_at, expires_at = display_window(m, now: now, existing: existing)
          post_repo.update_post(m.id, content: content, visibility: visibility, published_at: published_at, expires_at: expires_at)
          post = post_repo.find_by_id(m.id)
        end

        post_repo.save_media(post_id: post.id, media_data: media_data) if media_data.any? || !is_create
        post_repo.save_hashtags(post_id: post.id, hashtags: hashtags) if hashtags.any? || !is_create
        post_repo.save_mentions(post_id: post.id, mentions: mentions)
        post = post_repo.find_by_id(post.id)

        if is_create && published_at <= now
          mentions.uniq { |mention| mention[:profile_id] }
            .select { |mention| mention_visible?(mention[:profile_id], post) }
            .each do |mention|
            notifications_emit.call(
              recipient_profile_id: mention[:profile_id],
              type: "mention",
              target_resource_id: post.id,
              actor_profile_id: current_profile_id,
              target_post_id: post.id,
              excerpt: content
            )
          end
        end

        mentioned_usernames = mentioned_usernames_for(mentions.map { |m| m[:profile_id] })

        ::Post::V1::SavePostResponse.new(post: present_post(post, mentioned_usernames: mentioned_usernames))
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

      private

      def display_window(message, now:, existing: nil)
        requested_start = parse_display_time(message.published_at)
        requested_end = parse_display_time(message.expires_at)

        published_at = if existing && existing.published_at <= now
          if requested_start && requested_start.to_i != existing.published_at.to_i
            raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "表示開始は予約中の投稿だけ変更できます")
          end

          existing.published_at
        else
          if requested_start && requested_start <= now
            raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "表示開始は今より後の時刻を指定してください")
          end

          requested_start || now
        end

        # An end sent back unchanged may be past, so an expired post can still be edited.
        unchanged_end = existing&.expires_at && requested_end&.to_i == existing.expires_at.to_i
        expires_at = unchanged_end ? existing.expires_at : requested_end
        if expires_at && (expires_at <= published_at || (!unchanged_end && expires_at <= now))
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "表示終了は表示開始と今より後の時刻を指定してください")
        end

        [published_at, expires_at]
      end

      def parse_display_time(value)
        return nil if value.empty?

        Time.iso8601(value)
      rescue ArgumentError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "日時の形式が正しくありません")
      end

      def mention_visible?(profile_id, post)
        viewer_can_see_post.call(viewer_profile_id: profile_id, post: post)
      rescue StandardError => e
        Hanami.logger.warn("Mention visibility check failed: #{e.class}: #{e.message}")
        # SILENT: A failed visibility check skips that mention and must not fail the saved post.
        false
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
        authors = summarize_profiles.call(profile_ids: rows.map(&:author_profile_id))
        likes_counts = like_repo.likes_count_batch(post_ids: post_ids)
        comments_counts = comment_repo.comments_count_batch(post_ids: post_ids, exclude_author_profile_ids: [])
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
        authors = summarize_profiles.call(profile_ids: [post.author_profile_id])
        likes_count = like_repo.likes_count(post_id: post.id)
        comments_count = comment_repo.comments_count(post_id: post.id, exclude_author_profile_ids: [])
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

      def notifications_emit
        @notifications_emit ||= Notifications::Slice["use_cases.emit"]
      end

      def filter_visible_posts
        @filter_visible_posts ||= Social::Slice["use_cases.filter_visible_posts"]
      end
    end
  end
end
