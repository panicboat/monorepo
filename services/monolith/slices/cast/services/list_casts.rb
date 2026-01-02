module Cast
  module Services
    class ListCasts
      include Cast::Deps[repo: "repositories.cast_repo"]

      def call(status_filter: nil)
        repo.list_online(status_filter)
      end
    end
  end
end
