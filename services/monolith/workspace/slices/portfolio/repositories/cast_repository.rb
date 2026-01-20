module Portfolio
  module Repositories
    class CastRepository < Portfolio::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      def find_by_user_id(user_id)
        casts.where(user_id: user_id).one
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

      def update_plans(id, plans_data)
        transaction do
          cast_plans.where(cast_id: id).delete
          plans_data.each do |plan|
            cast_plans.changeset(:create, plan.merge(cast_id: id)).commit
          end
          find_with_plans(id)
        end
      end

      def update_schedules(id, schedules_data)
        transaction do
          cast_schedules.where(cast_id: id).delete
          schedules_data.each do |schedule|
            cast_schedules.changeset(:create, schedule.merge(cast_id: id)).commit
          end
          find_with_plans(id)
        end
      end

      def update_status(id, status)
        update(id, status: status)
      end

      def list_online(status_filter = nil)
        scope = casts.combine(:cast_plans, :cast_schedules)
        scope = scope.where(status: status_filter) if status_filter
        scope.to_a
      end
    end
  end
end
