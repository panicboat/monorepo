# frozen_string_literal: true

module Social
  module UseCases
    module Comments
      class DeleteComment
        include Social::Deps[comment_repo: "repositories.comment_repository"]

        def call(comment_id:, user_id:)
          result = comment_repo.delete_comment(id: comment_id, user_id: user_id)
          raise CommentNotFoundOrUnauthorizedError unless result

          # Get updated comments count
          comments_count = comment_repo.comments_count(post_id: result[:post_id])

          { comments_count: comments_count }
        end

        class CommentNotFoundOrUnauthorizedError < StandardError; end
      end
    end
  end
end
