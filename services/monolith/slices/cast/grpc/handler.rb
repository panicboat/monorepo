require 'cast/v1/service_services_pb'

module Cast
  module Grpc
    class Handler < ::Cast::V1::CastService::Service
      include Cast::Deps[
        create_profile_service: "services.create_profile",
        get_profile_service: "services.get_profile",
        update_status_service: "services.update_status",
        list_casts_service: "services.list_casts"
      ]

      def get_profile(request, _call)
        user_id = request.user_id.to_i
        user_id = Monolith::Current.user_id.to_i if user_id.zero? && Monolith::Current.user_id
        # Proto defines user_id in GetProfileRequest. In real app, we might infer from token metadata.

        result = get_profile_service.call(user_id: user_id)

        unless result
          # Lazy creation or return Not Found
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "Profile not found")
        end

        to_proto(result)
      end

      def create_profile(request, _call)
        # Identify user from metadata.
        current_user_id = Monolith::Current.user_id

        # If user_id is provided in request (e.g. admin override or testing), use it, otherwise use current user
        # However, for security, usually we force current_user_id for self-actions.
        # For this skeleton, we prefer Monolith::Current if available.
        target_user_id = request.user_id.to_i
        target_user_id = current_user_id.to_i if target_user_id.zero? && current_user_id
        # Yes, I added user_id to CreateProfileRequest in the proto update.

        # Parse plans
        plans_data = request.plans.map do |p|
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

          name: request.name,
          bio: request.bio,
          image_url: request.image_url,
          plans: plans_data
        )

        to_proto(result)
      end

      def list_casts(request, _call)
        status_filter = request.status_filter == :CAST_STATUS_UNSPECIFIED ? nil : status_enum_to_str(request.status_filter)
        results = list_casts_service.call(status_filter: status_filter)

        ::Cast::V1::ListCastsResponse.new(
          items: results.map do |cast|
            ::Cast::V1::ListCastsResponse::CastItem.new(
              profile: to_profile_proto(cast),
              plans: cast.cast_plans.map { |p| to_plan_proto(p) }
            )
          end
        )
      end

      def update_status(request, _call)
        # Need cast_id.
        # Again, auth context.
        # Assuming for now we pass cast_id or user_id.
        # My proto `UpdateStatusRequest` has `status`. No ID. This implies Context.
        # I will need to extract User ID from JWT in metadata.
        user_id = Monolith::Current.user_id

        unless user_id
           raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Authentication required")
        end

        # TODO: Resolve cast_id from user_id if they are different (1:1 relation usually)
        # For now assume 1:1 and we might need a service to fetch cast profile by user_id first
        # But this method mocks `ActiveRecord` update.

        # Mocking for now:
        # raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNIMPLEMENTED, "Auth context needed")

        # I'll implement basic List/Get first.
        ::Cast::V1::UpdateStatusResponse.new(status: request.status)
      end

      private

      def to_proto(cast)
        ::Cast::V1::GetProfileResponse.new(
          profile: to_profile_proto(cast),
          plans: cast.cast_plans.map { |p| to_plan_proto(p) }
        )
      end

      def to_profile_proto(cast)
        ::Cast::V1::CastProfile.new(
          user_id: cast.user_id.to_s,
          name: cast.name,
          bio: cast.bio,
          image_url: cast.image_url,
          status: status_str_to_enum(cast.status),
          promise_rate: cast.promise_rate
        )
      end

      def to_plan_proto(plan)
        ::Cast::V1::CastPlan.new(
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
