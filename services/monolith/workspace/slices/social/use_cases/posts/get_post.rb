# frozen_string_literal: true

module Social
  module UseCases
    module Posts
      class GetPost
        include Social::Deps[repo: "repositories.post_repository"]

        def call(id:)
          post = repo.find_by_id(id)
          return nil unless post
          return nil unless post.visible

          author = load_author(post.cast_id)
          { post: post, author: author }
        end

        private

        def load_author(cast_id)
          adapter = Social::Adapters::CastAdapter.new
          adapter.find_by_cast_id(cast_id)
        end
      end
    end
  end
end
