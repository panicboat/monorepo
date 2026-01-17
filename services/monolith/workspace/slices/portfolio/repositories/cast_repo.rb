module Portfolio
  module Repositories
    class CastRepo < Portfolio::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      def find_by_user_id(user_id)
        casts.where(user_id: user_id).one
      end

      def create_plan(data)
        cast_plans.command(:create).call(data)
      end

      def find_with_plans(id)
        casts.combine(:cast_plans).by_pk(id).one
      end

      def find_by_user_id_with_plans(user_id)
        casts.combine(:cast_plans).where(user_id: user_id).one
      end

      def create_with_plans(cast_data, plans_data)
        transaction do
          cast = create(cast_data)
          plans_data.each do |plan|
            cast_plans.changeset(:create, plan.merge(cast_id: cast.id)).commit
          end

          find_with_plans(cast.id)
        end
      end

      def update_status(id, status)
        update(id, status: status)
      end

      def list_online(status_filter = nil)
        scope = casts.combine(:cast_plans)
        scope = scope.where(status: status_filter) if status_filter
        scope.to_a
      end
    end
  end
end
