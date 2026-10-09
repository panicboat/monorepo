# frozen_string_literal: true

module Post
  module UseCases
    module Posts
      class ListReadablePostIds
        include Post::Deps[post_repo: "repositories.post_repository"]

        def call(post_ids:, viewer_profile_id:)
          posts = post_repo.find_by_ids(ids: post_ids)
          posts = posts.reject { |post| post.visibility == "private" && post.author_profile_id != viewer_profile_id }

          visibility_filter.call(viewer_profile_id: viewer_profile_id, posts: posts).map { |post| post.id.to_s }
        end

        private

        def visibility_filter
          @visibility_filter ||= Social::Slice["use_cases.filter_visible_posts"]
        end
      end
    end
  end
end
