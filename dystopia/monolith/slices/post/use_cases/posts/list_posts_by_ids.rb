# frozen_string_literal: true

module Post
  module UseCases
    module Posts
      class ListPostsByIds
        include Post::Deps[
          post_repo: "repositories.post_repository",
          like_repo: "repositories.like_repository",
          comment_repo: "repositories.comment_repository"
        ]
        include Post::Concerns::ProfileAuthorResolvable

        def call(post_ids:, viewer_account_id: nil)
          return {} if post_ids.nil? || post_ids.empty?

          posts = post_repo.find_by_ids(ids: post_ids)
          return {} if posts.empty?

          posts = visibility_filter.call(viewer_account_id: viewer_account_id, posts: posts)
          return {} if posts.empty?

          ids = posts.map(&:id)
          authors = profile_author_adapter.load(posts.map(&:author_id))
          likes_counts = like_repo.likes_count_batch(post_ids: ids)
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
