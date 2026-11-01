# frozen_string_literal: true

require "report/v1/report_service_services_pb"
require_relative "handler"

module Report
  module Grpc
    class ReportHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "report.v1.ReportService"

      bind ::Report::V1::ReportService::Service

      self.rpc_descs.clear

      rpc :CreateReport, ::Report::V1::CreateReportRequest, ::Report::V1::CreateReportResponse

      include Report::Deps[create_report_uc: "use_cases.create_report"]

      def create_report
        authenticate_user!
        message = request.message
        create_report_uc.call(
          reporter_account_id: current_account_id,
          reporter_profile_id: current_profile_id,
          target_type: message.target_type,
          target_id: message.target_id,
          reason: message.reason,
          note: message.note
        )
        ::Report::V1::CreateReportResponse.new
      rescue Errors::Invalid => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue Errors::NotFound => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, e.message)
      end
    end
  end
end
