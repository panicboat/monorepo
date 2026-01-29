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
    end
  end
end
