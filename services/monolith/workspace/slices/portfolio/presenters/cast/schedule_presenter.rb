# frozen_string_literal: true

module Portfolio
  module Presenters
    module Cast
      class SchedulePresenter
        def self.to_proto(schedule)
          return nil unless schedule

          ::Portfolio::V1::CastSchedule.new(
            date: schedule.date.to_s,
            start_time: schedule.start_time,
            end_time: schedule.end_time
          )
        end

        def self.many_to_proto(schedules)
          (schedules || []).map { |s| to_proto(s) }
        end
      end
    end
  end
end
