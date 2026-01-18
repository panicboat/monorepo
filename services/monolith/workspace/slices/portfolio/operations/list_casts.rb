module Portfolio
  module Operations
    class ListCasts
      include Portfolio::Deps[repo: "repositories.cast_repo"]

      def call(status_filter: nil)
        repo.list_online(status_filter)
      end
    end
  end
end
