module Portfolio
  module Repositories
    class CastRepository < Portfolio::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      def find_by_user_id(user_id)
        casts.where(user_id: user_id).one
      end

      def find_by_handle(handle)
        casts.combine(:cast_plans, :cast_schedules)
          .where { Sequel.function(:lower, :handle) =~ handle.downcase }
          .one
      end

      def handle_available?(handle, exclude_user_id: nil)
        scope = casts.where { Sequel.function(:lower, :handle) =~ handle.downcase }
        scope = scope.exclude(user_id: exclude_user_id) if exclude_user_id
        !scope.exist?
      end

      def create_plan(data)
        cast_plans.command(:create).call(data)
      end

      def find_with_plans(id)
        casts.combine(:cast_plans, :cast_schedules).by_pk(id).one
      end

      def find_by_user_id_with_plans(user_id)
        casts.combine(:cast_plans, :cast_schedules).where(user_id: user_id).one
      end

      def save_plans(id:, plans_data:)
        transaction do
          cast_plans.where(cast_id: id).delete
          plans_data.each do |plan|
            cast_plans.changeset(:create, plan.merge(cast_id: id)).commit
          end
          find_with_plans(id)
        end
      end

      def save_schedules(id:, schedules:)
        transaction do
          # Only delete schedules for today and future dates (preserve past schedules)
          today = Date.today.to_s
          cast_schedules.dataset.where(cast_id: id).where { date >= today }.delete
          schedules.each do |schedule|
            next if schedule[:date].to_s < today
            cast_schedules.changeset(:create, schedule.merge(cast_id: id)).commit
          end
          find_with_plans(id)
        end
      end

      def save_images(id:, image_path:, images:, avatar_path: nil)
        updates = {
          image_path: image_path,
          images: Sequel.pg_jsonb(images || [])
        }
        updates[:avatar_path] = avatar_path unless avatar_path.nil?
        casts.dataset.where(id: id).update(updates)
      end

      def save_visibility(id, visibility)
        update(id, visibility: visibility)
      end

      def list_by_visibility(visibility_filter = nil)
        scope = casts.combine(:cast_plans, :cast_schedules)
        scope = scope.where(visibility: visibility_filter) if visibility_filter
        scope.to_a
      end

      def save_areas(cast_id:, area_ids:)
        transaction do
          cast_areas.where(cast_id: cast_id).delete
          area_ids.each do |area_id|
            cast_areas.changeset(:create, cast_id: cast_id, area_id: area_id).commit
          end
        end
      end

      def find_area_ids(cast_id)
        cast_areas.where(cast_id: cast_id).pluck(:area_id)
      end

      def save_genres(cast_id:, genre_ids:)
        transaction do
          cast_genres.where(cast_id: cast_id).delete
          genre_ids.each do |genre_id|
            cast_genres.changeset(:create, cast_id: cast_id, genre_id: genre_id).commit
          end
        end
      end

      def find_genre_ids(cast_id)
        cast_genres.where(cast_id: cast_id).pluck(:genre_id)
      end

      def list_casts_with_filters(visibility_filter: nil, genre_id: nil, tag: nil, status_filter: nil, area_id: nil, query: nil, limit: nil, offset: nil)
        scope = casts.combine(:cast_plans, :cast_schedules)

        # Visibility filter (default: published only for guest access)
        scope = scope.where(visibility: visibility_filter) if visibility_filter

        # Text search filter (name, tagline, or tags)
        if query && !query.strip.empty?
          q = "%#{query.strip}%"
          scope = scope.where {
            (Sequel.ilike(:name, q)) |
            (Sequel.ilike(:tagline, q)) |
            Sequel.pg_jsonb(:tags).contains(Sequel.pg_jsonb([query.strip]))
          }
        end

        # Genre filter
        if genre_id && !genre_id.empty?
          cast_ids_with_genre = cast_genres.where(genre_id: genre_id).pluck(:cast_id)
          scope = scope.where(id: cast_ids_with_genre)
        end

        # Tag filter
        if tag && !tag.empty?
          # Search in JSONB tags array
          scope = scope.where { Sequel.pg_jsonb(:tags).contains(Sequel.pg_jsonb([tag])) }
        end

        # Area filter
        if area_id && !area_id.empty?
          cast_ids_with_area = cast_areas.where(area_id: area_id).pluck(:cast_id)
          scope = scope.where(id: cast_ids_with_area)
        end

        # Status filter
        case status_filter
        when :online
          # Has schedule today and current time is within the schedule time range
          today = Date.today.to_s
          now = Time.now.strftime("%H:%M")
          cast_ids_online = cast_schedules
            .where(date: today)
            .where { start_time <= now }
            .where { end_time >= now }
            .pluck(:cast_id)
            .uniq
          scope = scope.where(id: cast_ids_online)
        when :new
          # Created within 7 days
          seven_days_ago = (Date.today - 7).to_datetime
          scope = scope.where { created_at >= seven_days_ago }
        when :ranking
          # Future: by popularity (for now, just return all)
        end

        # Pagination
        scope = scope.limit(limit) if limit && limit > 0
        scope = scope.offset(offset) if offset && offset > 0

        scope.to_a
      end

      def is_online?(cast_id)
        today = Date.today.to_s
        now = Time.now.strftime("%H:%M")
        cast_schedules
          .where(cast_id: cast_id, date: today)
          .where { start_time <= now }
          .where { end_time >= now }
          .exist?
      end

      def online_cast_ids
        today = Date.today.to_s
        now = Time.now.strftime("%H:%M")
        cast_schedules
          .where(date: today)
          .where { start_time <= now }
          .where { end_time >= now }
          .pluck(:cast_id)
          .uniq
      end

      def get_popular_tags(limit: 20)
        # Aggregate tags from all published casts
        result = casts.where(visibility: "published")
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
    end
  end
end
