# frozen_string_literal: true

module Post
  module UseCases
    module Posts
      # Cross-slice hydration: feed slice (and any future consumer) passes a list of
      # post ids + the viewer's account id, and receives a Hash<post_id_string => Post::V1::Post>
      # with author, engagement counts, viewer-perspective liked flag, and media URLs filled in.
      # The hash shape (rather than an ordered array) lets callers re-order or drop missing
      # entries without depending on this use_case's return order.
      class ListPostsByIds
        include Post::Deps[
          post_repo: "repositories.post_repository",
          like_repo: "repositories.like_repository",
          comment_repo: "repositories.comment_repository"
        ]
        include Post::Concerns::ProfileAuthorResolvable

        # @param post_ids [Array<String>] ordered post ids to hydrate (order not preserved in result)
        # @param viewer_account_id [String, nil] account id of the request viewer; nil = unauthenticated
        # @return [Hash{String => Post::V1::Post}] keyed by post_id (string), missing posts omitted
        def call(post_ids:, viewer_account_id: nil)
          return {} if post_ids.nil? || post_ids.empty?

          posts = post_repo.find_by_ids(ids: post_ids)
          return {} if posts.empty?

          posts = visibility_filter.call(viewer_account_id: viewer_account_id, posts: posts)
          return {} if posts.empty?

          ids = posts.map(&:id)
          authors = profile_author_adapter.load(posts.map(&:author_id))
          likes_counts = like_repo.likes_count_batch(post_ids: ids)
          # Block list applies to post-level display (caller's responsibility); comment
          # count is a per-post aggregate so we intentionally pass an empty exclude list
          # rather than relying on the default to make the design choice explicit.
          comments_counts = comment_repo.comments_count_batch(post_ids: ids, exclude_user_ids: [])
          liked = if viewer_account_id
            like_repo.account_liked_status_batch(post_ids: ids, account_id: viewer_account_id)
          else
            {}
          end
          media_files = load_media_files(posts)

          posts.each_with_object({}) do |post, hash|
            proto = Post::Presenters::PostPresenter.to_post_proto(
              post,
              author: authors[post.author_id],
              likes_count: likes_counts[post.id] || 0,
              comments_count: comments_counts[post.id] || 0,
              liked: liked[post.id] || false,
              media_files: media_files
            )
            hash[post.id.to_s] = proto if proto
          end
        end

        private

        # Same pattern as post_handler#load_media_files_for_posts. Inlined here to avoid
        # cross-class coupling (handler stays untouched; this use_case is self-contained).
        def load_media_files(posts)
          media_ids = posts.flat_map do |post|
            next [] unless post.respond_to?(:post_media)

            (post.post_media || []).filter_map(&:media_id)
          end.uniq

          return {} if media_ids.empty?

          media_adapter.find_by_ids(media_ids)
        end

        def media_adapter
          @media_adapter ||= Post::Adapters::MediaAdapter.new
        end

        def visibility_filter
          @visibility_filter ||= Social::Slice["use_cases.filter_visible_posts"]
        end
      end
    end
  end
end
