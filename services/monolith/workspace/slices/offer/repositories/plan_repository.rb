# frozen_string_literal: true

module Offer
  module Repositories
    class PlanRepository < Offer::DB::Repo
      def find_by_cast_id(cast_id)
        plans.where(cast_id: cast_id).to_a
      end

      def save_plans(cast_id:, plans_data:)
        transaction do
          plans.where(cast_id: cast_id).delete
          plans_data.each do |plan|
            plans.changeset(:create, plan.merge(cast_id: cast_id)).commit
          end
          find_by_cast_id(cast_id)
        end
      end
    end
  end
end
