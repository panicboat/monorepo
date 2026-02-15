# frozen_string_literal: true

module Offer
  module Repositories
    class OfferRepository < Offer::DB::Repo
      commands :create, update: :by_pk, delete: :by_pk

      # === Plans ===

      def find_plans_by_cast_id(cast_id)
        cast_plans.where(cast_id: cast_id).to_a
      end

      def save_plans(cast_id:, plans_data:)
        transaction do
          cast_plans.where(cast_id: cast_id).delete
          plans_data.each do |plan|
            cast_plans.changeset(:create, plan.merge(cast_id: cast_id)).commit
          end
          find_plans_by_cast_id(cast_id)
        end
      end

      # === Schedules ===

      def find_schedules_by_cast_id(cast_id, start_date: nil, end_date: nil)
        scope = cast_schedules.where(cast_id: cast_id)
        scope = scope.where { date >= start_date } if start_date
        scope = scope.where { date <= end_date } if end_date
        scope.order(:date, :start_time).to_a
      end

      def save_schedules(cast_id:, schedules:)
        transaction do
          # Only delete schedules for today and future dates (preserve past schedules)
          today = Date.today.to_s
          cast_schedules.dataset.where(cast_id: cast_id).where { date >= today }.delete
          schedules.each do |schedule|
            next if schedule[:date].to_s < today
            cast_schedules.changeset(:create, schedule.merge(cast_id: cast_id)).commit
          end
          find_schedules_by_cast_id(cast_id)
        end
      end
    end
  end
end
