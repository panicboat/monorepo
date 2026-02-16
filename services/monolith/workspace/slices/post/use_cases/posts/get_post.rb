# frozen_string_literal: true

module Post
  module UseCases
    module Posts
      class GetPost
        include Post::Deps[repo: "repositories.post_repository"]

        def call(id:)
          post = repo.find_by_id(id)
          return nil unless post

          author = load_author(post.cast_id)
          { post: post, author: author }
        end

        private

        def load_author(cast_id)
          adapter = Post::Adapters::CastAdapter.new
          adapter.find_by_cast_id(cast_id)
        end
      end
    end
  end
end
