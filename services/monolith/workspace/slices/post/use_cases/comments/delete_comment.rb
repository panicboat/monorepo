# frozen_string_literal: true

module Post
  module UseCases
    module Comments
      class DeleteComment
        include Post::Deps[comment_repo: "repositories.comment_repository"]

        def call(comment_id:, user_id:)
          result = comment_repo.delete_comment(id: comment_id, user_id: user_id)
          raise CommentNotFoundOrUnauthorizedError unless result

          { post_id: result[:post_id] }
        end

        class CommentNotFoundOrUnauthorizedError < StandardError; end
      end
    end
  end
end
