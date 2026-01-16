require 'identity/v1/service_services_pb'

module Identity
  module Grpc
    class Handler < Gruf::Controllers::Base
      include GRPC::GenericService
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = 'identity.v1.IdentityService'

      bind ::Identity::V1::IdentityService::Service

      # Clear legacy/bind-generated descriptors to avoid duplication ("already registered" error)
      self.rpc_descs.clear

      rpc :HealthCheck, ::Identity::V1::HealthCheckRequest, ::Identity::V1::HealthCheckResponse
      rpc :SendSms, ::Identity::V1::SendSmsRequest, ::Identity::V1::SendSmsResponse
      rpc :VerifySms, ::Identity::V1::VerifySmsRequest, ::Identity::V1::VerifySmsResponse
      rpc :Register, ::Identity::V1::RegisterRequest, ::Identity::V1::RegisterResponse
      rpc :Login, ::Identity::V1::LoginRequest, ::Identity::V1::LoginResponse
      rpc :GetCurrentUser, ::Google::Protobuf::Empty, ::Identity::V1::UserProfile

      include Identity::Deps[
        register_service: "services.register",
        login_service: "services.login",
        send_sms_service: "services.send_sms",
        verify_sms_service: "services.verify_sms",
        get_current_user_service: "services.get_current_user"
      ]

      def health_check
        ::Identity::V1::HealthCheckResponse.new(status: "serving")
      end

      def send_sms
        send_sms_service.call(phone_number: request.message.phone_number)
        ::Identity::V1::SendSmsResponse.new(success: true)
      end

      def verify_sms
        result = verify_sms_service.call(phone_number: request.message.phone_number, code: request.message.code)

        unless result[:success]
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Invalid code or expired")
        end

        ::Identity::V1::VerifySmsResponse.new(verification_token: result[:verification_token])
      end

      def register
        # TODO: Support Cast registration flow and role assignment.
        # Currently defaulting to Guest (1) for all self-registrations via this endpoint.
        role_int = 1 # Guest

        result = register_service.call(
          phone_number: request.message.phone_number,
          password: request.message.password,
          verification_token: request.message.verification_token,
          role: role_int
        )

        to_register_response(result)
      rescue => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INTERNAL, e.message)
      end

      def login
        result = login_service.call(phone_number: request.message.phone_number, password: request.message.password)

        if result
          to_login_response(result)
        else
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Invalid credentials")
        end
      end

      def get_current_user
        # Extract user_id from metadata (handled by interceptor potentially)
        # OR decode JWT here if no interceptor.
        # Assumption: ::Current.user_id is set.
        user_id = ::Current.user_id

        unless user_id
           raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Unauthenticated")
        end

        result = get_current_user_service.call(user_id: user_id)

        unless result
           raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "User not found")
        end

        ::Identity::V1::UserProfile.new(
          id: result[:id],
          phone_number: result[:phone_number],
          role: role_int_to_enum(result[:role])
        )
      end

      private

      def to_register_response(result)
        ::Identity::V1::RegisterResponse.new(
          access_token: result[:access_token],
          user_profile: to_user_profile_proto(result[:user_profile])
        )
      end

      def to_login_response(result)
        ::Identity::V1::LoginResponse.new(
          access_token: result[:access_token],
          user_profile: to_user_profile_proto(result[:user_profile])
        )
      end

      def to_user_profile_proto(profile)
        ::Identity::V1::UserProfile.new(
          id: profile[:id],
          phone_number: profile[:phone_number],
          role: role_int_to_enum(profile[:role])
        )
      end

      def role_int_to_enum(role_int)
        case role_int
        when 2 then :ROLE_CAST
        else :ROLE_GUEST
        end
      end
    end
  end
end
