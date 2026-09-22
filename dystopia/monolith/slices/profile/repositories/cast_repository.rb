module Profile
  module Repositories
    class CastRepository < Profile::DB::Repo
      commands :create, update: :by_pk

      # PK is user_id (no separate id column)
      def find_by_user_id(user_id)
        casts.by_pk(user_id).one
      end

      def upsert(user_id:, attrs:)
        if casts.by_pk(user_id).exist?
          update(user_id, attrs.merge(updated_at: Time.now))
        else
          create(attrs.merge(user_id: user_id))
        end
      end
    end
  end
end
