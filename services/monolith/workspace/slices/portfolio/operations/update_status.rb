module Portfolio
  module Operations
    class UpdateStatus
      include Portfolio::Deps[repo: "repositories.cast_repo"]

      def call(cast_id:, status:)
        # status is string enum
        repo.update_status(cast_id, status)
      end
    end
  end
end
