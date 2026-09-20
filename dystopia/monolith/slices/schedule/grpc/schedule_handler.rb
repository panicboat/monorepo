# frozen_string_literal: true

require "schedule/v1/schedule_service_services_pb"
require_relative "handler"
require "errors/validation_error"

module Schedule
  module Grpc
    class ScheduleHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "schedule.v1.ScheduleService"

      bind ::Schedule::V1::ScheduleService::Service

      self.rpc_descs.clear

      rpc :ListSchedules, ::Schedule::V1::ListSchedulesRequest, ::Schedule::V1::ListSchedulesResponse
      rpc :SaveSchedule, ::Schedule::V1::SaveScheduleRequest, ::Schedule::V1::SaveScheduleResponse
      rpc :DeleteSchedule, ::Schedule::V1::DeleteScheduleRequest, ::Schedule::V1::DeleteScheduleResponse

      include Schedule::Deps[
        list_schedules_uc: "use_cases.list_schedules",
        save_schedule_uc: "use_cases.save_schedule",
        delete_schedule_uc: "use_cases.delete_schedule"
      ]

      def list_schedules
        authenticate_user!
        m = request.message
        rows = list_schedules_uc.call(account_id: m.account_id, from_date: m.from_date, to_date: m.to_date)

        ::Schedule::V1::ListSchedulesResponse.new(
          schedules: rows.map { |r|
            ::Schedule::V1::Schedule.new(
              account_id: r.account_id.to_s,
              work_date: r.work_date.to_s,
              start_time: r.start_time.to_s,
              end_time: r.end_time.to_s
            )
          }
        )
      end

      def save_schedule
        authenticate_user!
        m = request.message
        row = save_schedule_uc.call(
          account_id: current_user_id,
          work_date: m.work_date,
          start_time: m.start_time,
          end_time: m.end_time
        )

        ::Schedule::V1::SaveScheduleResponse.new(
          schedule: ::Schedule::V1::Schedule.new(
            account_id: row[:account_id].to_s,
            work_date: row[:work_date].to_s,
            start_time: row[:start_time],
            end_time: row[:end_time]
          )
        )
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def delete_schedule
        authenticate_user!
        delete_schedule_uc.call(account_id: current_user_id, work_date: request.message.work_date)
        ::Schedule::V1::DeleteScheduleResponse.new
      end
    end
  end
end
