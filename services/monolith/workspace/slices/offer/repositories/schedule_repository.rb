# frozen_string_literal: true

module Offer
  module Repositories
    class ScheduleRepository < Offer::DB::Repo
      def find_by_cast_id(cast_id, start_date: nil, end_date: nil)
        scope = cast_schedules.where(cast_id: cast_id)
        scope = scope.where { date >= start_date } if start_date
        scope = scope.where { date <= end_date } if end_date
        scope.order(:date, :start_time).to_a
      end

      def save_schedules(cast_id:, schedules:)
        today = Date.today.to_s
        transaction do
          # Only delete schedules for today and future dates (preserve past schedules)
          cast_schedules.dataset.where(cast_id: cast_id).where { date >= today }.delete
          schedules.each do |schedule|
            next if schedule[:date].to_s < today
            cast_schedules.changeset(:create, schedule.merge(cast_id: cast_id)).commit
          end
          find_by_cast_id(cast_id)
        end
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
    end
  end
end
