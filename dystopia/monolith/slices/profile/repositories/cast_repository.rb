module Profile
  module Repositories
    class CastRepository < Profile::DB::Repo
      commands :create, update: :by_pk

      # PK is user_id (no separate id column)
      def find_by_user_id(user_id)
        casts.by_pk(user_id).one
      end

      # find_by_id is now equivalent to find_by_user_id since PK = user_id
      def find_by_id(id)
        casts.by_pk(id).one
      end

      # find_by_ids now uses user_id (which is the PK)
      def find_by_ids(ids)
        return [] if ids.nil? || ids.empty?

        casts.where(user_id: ids).to_a
      end

      # find_by_user_ids is equivalent to find_by_ids since PK = user_id
      def find_by_user_ids(user_ids)
        return [] if user_ids.nil? || user_ids.empty?

        casts.where(user_id: user_ids).to_a
      end

      def find_gallery_media_ids(cast_user_id)
        cast_gallery_media.where(cast_user_id: cast_user_id).order(:position).pluck(:media_id)
      end

      def save_visibility(user_id, visibility)
        update(user_id, visibility: visibility)
      end

      def save_genres(cast_user_id:, genre_ids:)
        transaction do
          cast_genres.where(cast_user_id: cast_user_id).delete
          genre_ids.each do |genre_id|
            cast_genres.changeset(:create, id: SecureRandom.uuid_v7, cast_user_id: cast_user_id, genre_id: genre_id).commit
          end
        end
      end

      def find_genre_ids(cast_user_id)
        cast_genres.where(cast_user_id: cast_user_id).pluck(:genre_id)
      end

      def public_cast_ids
        casts.where(visibility: "public").pluck(:user_id)
      end
    end
  end
end
