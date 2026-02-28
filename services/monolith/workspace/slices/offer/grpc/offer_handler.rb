# frozen_string_literal: true

require "offer/v1/service_services_pb"
require_relative "handler"

module Offer
  module Grpc
    class OfferHandler < Handler
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "offer.v1.OfferService"

      bind ::Offer::V1::OfferService::Service

      self.rpc_descs.clear

      rpc :GetPlans, ::Offer::V1::GetPlansRequest, ::Offer::V1::GetPlansResponse
      rpc :SavePlans, ::Offer::V1::SavePlansRequest, ::Offer::V1::SavePlansResponse
      rpc :GetSchedules, ::Offer::V1::GetSchedulesRequest, ::Offer::V1::GetSchedulesResponse
      rpc :SaveSchedules, ::Offer::V1::SaveSchedulesRequest, ::Offer::V1::SaveSchedulesResponse

      include Offer::Deps[
        get_plans_uc: "use_cases.plans.get_plans",
        save_plans_uc: "use_cases.plans.save_plans",
        get_schedules_uc: "use_cases.schedules.get_schedules",
        save_schedules_uc: "use_cases.schedules.save_schedules",
        portfolio_adapter: "adapters.portfolio_adapter"
      ]

      # === Plans ===

      def get_plans
        cast_id = resolve_cast_id(request.message.cast_user_id)

        plans = get_plans_uc.call(cast_user_id: cast_id)

        ::Offer::V1::GetPlansResponse.new(
          plans: PlanPresenter.many_to_proto(plans)
        )
      rescue GetPlans::CastNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast not found")
      end

      def save_plans
        authenticate_user!
        cast = find_my_cast!

        plans_data = request.message.plans.map do |p|
          {
            name: p.name,
            price: p.price || 0, # 0 = Ask
            duration_minutes: p.duration_minutes,
            is_recommended: p.is_recommended
          }
        end

        result = save_plans_uc.call(cast_user_id: cast.user_id, plans: plans_data)

        ::Offer::V1::SavePlansResponse.new(
          plans: PlanPresenter.many_to_proto(result)
        )
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue SavePlans::CastNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast not found")
      end

      # === Schedules ===

      def get_schedules
        cast_id = resolve_cast_id(request.message.cast_user_id)
        start_date = request.message.start_date.to_s.empty? ? nil : request.message.start_date
        end_date = request.message.end_date.to_s.empty? ? nil : request.message.end_date

        schedules = get_schedules_uc.call(cast_user_id: cast_id, start_date: start_date, end_date: end_date)

        ::Offer::V1::GetSchedulesResponse.new(
          schedules: SchedulePresenter.many_to_proto(schedules)
        )
      rescue GetSchedules::CastNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast not found")
      end

      def save_schedules
        authenticate_user!
        cast = find_my_cast!

        schedules_data = request.message.schedules.map do |s|
          { date: s.date, start_time: s.start_time, end_time: s.end_time }
        end

        result = save_schedules_uc.call(cast_user_id: cast.user_id, schedules: schedules_data)

        ::Offer::V1::SaveSchedulesResponse.new(
          schedules: SchedulePresenter.many_to_proto(result)
        )
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      rescue SaveSchedules::CastNotFoundError
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast not found")
      end

      private

      PlanPresenter = Offer::Presenters::PlanPresenter
      SchedulePresenter = Offer::Presenters::SchedulePresenter
      GetPlans = Offer::UseCases::Plans::GetPlans
      SavePlans = Offer::UseCases::Plans::SavePlans
      GetSchedules = Offer::UseCases::Schedules::GetSchedules
      SaveSchedules = Offer::UseCases::Schedules::SaveSchedules

      # Resolve cast_id from request or current user
      def resolve_cast_id(cast_id)
        return cast_id unless cast_id.nil? || cast_id.empty?

        # If no cast_id provided, try to get current user's cast
        if current_user_id
          cast = portfolio_adapter.find_cast_by_user_id(current_user_id)
          return cast.user_id if cast
        end

        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "cast_id is required")
      end

      def find_my_cast!
        cast = portfolio_adapter.find_cast_by_user_id(current_user_id)
        unless cast
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Cast profile not found")
        end
        cast
      end
    end
  end
end
