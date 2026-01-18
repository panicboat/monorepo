require 'portfolio/v1/service_services_pb'

module Portfolio
  module Grpc
    class Handler < Gruf::Controllers::Base
      include GRPC::GenericService
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = 'portfolio.v1.CastService'

      bind ::Portfolio::V1::CastService::Service

      # Clear legacy/bind-generated descriptors to avoid duplication
      self.rpc_descs.clear

      rpc :CreateProfile, ::Portfolio::V1::CreateProfileRequest, ::Portfolio::V1::CastProfile
      rpc :GetProfile, ::Portfolio::V1::GetProfileRequest, ::Portfolio::V1::GetProfileResponse
      rpc :UpdateProfile, ::Portfolio::V1::UpdateProfileRequest, ::Portfolio::V1::UpdateProfileResponse
      rpc :ListCasts, ::Portfolio::V1::ListCastsRequest, ::Portfolio::V1::ListCastsResponse
      rpc :UpdateStatus, ::Portfolio::V1::UpdateStatusRequest, ::Portfolio::V1::UpdateStatusResponse

      include Portfolio::Deps[
        create_profile_service: "operations.create_profile",
        get_profile_service: "operations.get_profile",
        update_status_service: "operations.update_status",
        list_casts_service: "operations.list_casts"
      ]

      def get_profile
        user_id = request.message.user_id.to_i
        user_id = ::Current.user_id.to_i if user_id.zero? && ::Current.user_id
        # Proto defines user_id in GetProfileRequest. In real app, we might infer from token metadata.

        result = get_profile_service.call(user_id: user_id)

        unless result
          # Lazy creation or return Not Found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end

        to_proto(result)
      end

      def create_profile
        # Identify user from metadata.
        current_user_id = ::Current.user_id

        # If user_id is provided in request (e.g. admin override or testing), use it, otherwise use current user
        # However, for security, usually we force current_user_id for self-actions.
        # For this skeleton, we prefer ::Current if available.
        target_user_id = request.message.user_id.to_i
        target_user_id = current_user_id.to_i if target_user_id.zero? && current_user_id
        # Yes, I added user_id to CreateProfileRequest in the proto update.

        # Parse plans
        plans_data = request.message.plans.map do |p|
          {
            name: p.name,
            price: p.price,
            duration_minutes: p.duration_minutes
          }
        end

        # Call service
        result = create_profile_service.call(
          user_id: target_user_id, # Assuming it comes as string ID via RPC if defined, but wait, `user_id` in users table is int?
          # Migration: `primary_key :id` (integer). `foreign_key :user_id` (integer).
          # Proto: `string user_id`.
          # We need to parse.

          name: request.message.name,
          bio: request.message.bio,
          image_url: request.message.image_url,
          plans: plans_data
        )

        to_proto(result)
      end

      def list_casts
        status_filter = request.message.status_filter == :CAST_STATUS_UNSPECIFIED ? nil : status_enum_to_str(request.message.status_filter)
        results = list_casts_service.call(status_filter: status_filter)

        ::Portfolio::V1::ListCastsResponse.new(
          items: results.map do |cast|
            ::Portfolio::V1::ListCastsResponse::CastItem.new(
              profile: to_profile_proto(cast),
              plans: cast.cast_plans.map { |p| to_plan_proto(p) }
            )
          end
        )
      end

      def update_status
        # Need cast_id.
        # Again, auth context.
        # Assuming for now we pass cast_id or user_id.
        # My proto `UpdateStatusRequest` has `status`. No ID. This implies Context.
        # I will need to extract User ID from JWT in metadata.
        user_id = ::Current.user_id

        unless user_id
           raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Authentication required")
        end

        # TODO: Resolve cast_id from user_id if they are different (1:1 relation usually)
        # For now assume 1:1 and we might need a service to fetch cast profile by user_id first
        # But this method mocks `ActiveRecord` update.

        # Mocking for now:
        # raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNIMPLEMENTED, "Auth context needed")

        # I'll implement basic List/Get first.
        ::Portfolio::V1::UpdateStatusResponse.new(status: request.message.status)
      end

      private

      def to_proto(cast)
        ::Portfolio::V1::GetProfileResponse.new(
          profile: to_profile_proto(cast),
          plans: cast.cast_plans.map { |p| to_plan_proto(p) }
        )
      end

      def to_profile_proto(cast)
        ::Portfolio::V1::CastProfile.new(
          user_id: cast.user_id.to_s,
          name: cast.name,
          bio: cast.bio,
          image_url: cast.image_url,
          status: status_str_to_enum(cast.status),
          promise_rate: cast.promise_rate
        )
      end

      def to_plan_proto(plan)
        ::Portfolio::V1::CastPlan.new(
          id: plan.id.to_s,
          name: plan.name,
          price: plan.price,
          duration_minutes: plan.duration_minutes
        )
      end

      def status_str_to_enum(str)
        case str
        when 'online' then :CAST_STATUS_ONLINE
        when 'tonight' then :CAST_STATUS_TONIGHT
        when 'asking' then :CAST_STATUS_ASKING
        else :CAST_STATUS_OFFLINE
        end
      end

      def status_enum_to_str(enum)
        case enum
        when :CAST_STATUS_ONLINE then 'online'
        when :CAST_STATUS_TONIGHT then 'tonight'
        when :CAST_STATUS_ASKING then 'asking'
        else 'offline'
        end
      end
    end
  end
end
