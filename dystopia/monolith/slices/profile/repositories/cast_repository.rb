module Profile
  module Repositories
    class CastRepository < Profile::DB::Repo
      commands :create, update: :by_pk

      def find_by_profile_id(profile_id)
        casts.by_pk(profile_id).one
      end

      def upsert(profile_id:, attrs:)
        if casts.by_pk(profile_id).exist?
          update(profile_id, attrs.merge(updated_at: Time.now))
        else
          create(attrs.merge(profile_id: profile_id))
        end
      end

      def delete_by_profile_ids(profile_ids)
        return if profile_ids.empty?

        casts.dataset.where(profile_id: profile_ids).delete
      end
    end
  end
end
