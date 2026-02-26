# frozen_string_literal: true

module Offer
  module Repositories
    class OfferRepository < Offer::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      # === Plans ===

      def find_plans_by_cast_id(cast_user_id)
        plans.where(cast_user_id: cast_user_id).to_a
      end

      def save_plans(cast_user_id:, plans_data:)
        transaction do
          plans.where(cast_user_id: cast_user_id).delete
          plans_data.each do |plan|
            plans.changeset(:create, plan.merge(cast_user_id: cast_user_id)).commit
          end
          find_plans_by_cast_id(cast_user_id)
        end
      end

      # === Schedules ===

      def find_schedules_by_cast_id(cast_user_id, start_date: nil, end_date: nil)
        scope = schedules.where(cast_user_id: cast_user_id)
        scope = scope.where { date >= start_date } if start_date
        scope = scope.where { date <= end_date } if end_date
        scope.order(:date, :start_time).to_a
      end

      def save_schedules(cast_user_id:, schedules_data:)
        transaction do
          # Only delete schedules for today and future dates (preserve past schedules)
          today = Date.today.to_s
          schedules.dataset.where(cast_user_id: cast_user_id).where { date >= today }.delete
          schedules_data.each do |schedule|
            next if schedule[:date].to_s < today
            schedules.changeset(:create, schedule.merge(cast_user_id: cast_user_id)).commit
          end
          find_schedules_by_cast_id(cast_user_id)
        end
      end
    end
  end
end
