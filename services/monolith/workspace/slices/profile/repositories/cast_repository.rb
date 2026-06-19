module Profile
  module Repositories
    class CastRepository < Profile::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

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

      def find_by_slug(slug)
        casts.where { Sequel.function(:lower, :slug) =~ slug.downcase }.one
      end

      def slug_available?(slug, exclude_user_id: nil)
        scope = casts.where { Sequel.function(:lower, :slug) =~ slug.downcase }
        scope = scope.exclude(user_id: exclude_user_id) if exclude_user_id
        !scope.exist?
      end

      # Note: Plan/Schedule write operations were removed in 2026-05-29 commerce dimension drop.

      def find_with_plans(user_id)
        casts.combine(:plans, :cast_gallery_media).by_pk(user_id).one
      end

      def find_gallery_media_ids(cast_user_id)
        cast_gallery_media.where(cast_user_id: cast_user_id).order(:position).pluck(:media_id)
      end

      def find_by_user_id_with_plans(user_id)
        casts.combine(:plans).where(user_id: user_id).one
      end

      def save_images(user_id:, profile_media_id:, gallery_media_ids:, avatar_media_id: nil)
        transaction do
          updates = { profile_media_id: profile_media_id }
          updates[:avatar_media_id] = avatar_media_id unless avatar_media_id.nil?
          casts.dataset.where(user_id: user_id).update(updates)

          # Save gallery media
          cast_gallery_media.where(cast_user_id: user_id).delete
          (gallery_media_ids || []).each_with_index do |media_id, idx|
            cast_gallery_media.changeset(:create, id: SecureRandom.uuid_v7, cast_user_id: user_id, media_id: media_id, position: idx).commit
          end
        end
      end

      def save_visibility(user_id, visibility)
        update(user_id, visibility: visibility)
      end

      def complete_registration(user_id)
        update(user_id, registered_at: Time.now)
      end

      def is_registered?(user_id)
        cast = casts.by_pk(user_id).one
        return false unless cast

        !cast.registered_at.nil?
      end

      def list_by_visibility(visibility_filter = nil)
        scope = casts.combine(:plans)
        scope = scope.where(visibility: visibility_filter) if visibility_filter
        scope.to_a
      end

      def save_areas(cast_user_id:, area_ids:)
        transaction do
          cast_areas.where(cast_user_id: cast_user_id).delete
          area_ids.each do |area_id|
            cast_areas.changeset(:create, cast_user_id: cast_user_id, area_id: area_id).commit
          end
        end
      end

      def find_area_ids(cast_user_id)
        cast_areas.where(cast_user_id: cast_user_id).pluck(:area_id)
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

      # Load areas and genres together in minimal queries.
      #
      # @param cast_user_id [String] the cast user ID
      # @return [Hash] { area_ids: [...], genre_ids: [...] }
      def find_area_and_genre_ids(cast_user_id)
        {
          area_ids: cast_areas.where(cast_user_id: cast_user_id).pluck(:area_id),
          genre_ids: cast_genres.where(cast_user_id: cast_user_id).pluck(:genre_id)
        }
      end

      def get_popular_tags(limit: 20)
        # Aggregate tags from all registered casts
        result = casts.exclude(registered_at: nil)
          .exclude(tags: nil)
          .select(:tags)
          .to_a

        tag_counts = Hash.new(0)
        result.each do |cast|
          tags_array = cast.tags.to_a rescue []
          tags_array.each { |t| tag_counts[t] += 1 }
        end

        tag_counts.sort_by { |_, count| -count }
          .take(limit)
          .map { |name, count| { name: name, usage_count: count } }
      end

      def public_cast_ids
        casts.where(visibility: "public")
          .exclude(registered_at: nil)
          .pluck(:user_id)
      end

      def area_ids_by_prefecture(prefecture)
        areas.where(prefecture: prefecture, active: true).pluck(:id)
      end

      def cast_user_ids_by_area_ids(area_ids)
        return [] if area_ids.empty?

        cast_areas.where(area_id: area_ids).pluck(:cast_user_id).uniq
      end

      def private_cast_ids
        casts.where(visibility: "private")
          .exclude(registered_at: nil)
          .pluck(:user_id)
      end
    end
  end
end
