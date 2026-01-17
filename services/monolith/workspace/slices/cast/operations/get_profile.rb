module Cast
  module Operations
    class GetProfile
      include Cast::Deps[repo: "repositories.cast_repo"]

      def call(user_id:)
        repo.find_by_user_id_with_plans(user_id)
      end
    end
  end
end
