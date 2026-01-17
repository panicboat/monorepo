module Cast
  module Operations
    class UpdateStatus
      include Cast::Deps[repo: "repositories.cast_repo"]

      def call(cast_id:, status:)
        # status is string enum
        repo.update_status(cast_id, status)
      end
    end
  end
end
