# frozen_string_literal: true

require "dry/validation"

module Portfolio
  module Contracts
    module Cast
      class SaveSchedulesContract < Dry::Validation::Contract
        TIME_FORMAT_REGEX = /\A([01]?[0-9]|2[0-3]):[0-5][0-9]\z/

        params do
          required(:cast_id).filled(:string)
          required(:schedules).array(:hash) do
            required(:date).filled(:date)
            required(:start_time).filled(:string)
            required(:end_time).filled(:string)
          end
        end

        rule(:schedules).each do |index:|
          schedule = value

          if schedule[:start_time] && !schedule[:start_time].match?(TIME_FORMAT_REGEX)
            key([:schedules, index, :start_time]).failure("は有効な時刻形式（HH:MM）で入力してください")
          end

          if schedule[:end_time] && !schedule[:end_time].match?(TIME_FORMAT_REGEX)
            key([:schedules, index, :end_time]).failure("は有効な時刻形式（HH:MM）で入力してください")
          end

          if schedule[:start_time] && schedule[:end_time] &&
             schedule[:start_time].match?(TIME_FORMAT_REGEX) &&
             schedule[:end_time].match?(TIME_FORMAT_REGEX)

            start_minutes = parse_time_to_minutes(schedule[:start_time])
            end_minutes = parse_time_to_minutes(schedule[:end_time])

            if start_minutes >= end_minutes
              # key([:schedules, index, :end_time]).failure("は開始時刻より後の時刻を指定してください")
            end
          end

          if schedule[:date] && schedule[:date] < Date.today
            # key([:schedules, index, :date]).failure("は今日以降の日付を指定してください")
          end
        end

        private

        def parse_time_to_minutes(time_str)
          hours, minutes = time_str.split(":").map(&:to_i)
          hours * 60 + minutes
        end
      end
    end
  end
end
