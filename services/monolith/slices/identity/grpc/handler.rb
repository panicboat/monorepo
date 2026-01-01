require 'identity/v1/service_services_pb'

module Identity
  module Grpc
    class Handler < ::Identity::V1::IdentityService::Service

      include Identity::Deps[
        register_service: "services.register",
        login_service: "services.login"
      ]

      def health_check(request, _call)
        ::Identity::V1::HealthCheckResponse.new(status: "serving")
      end

      def register(request, _call)
        role_enum = request.role
        # role_enum is :ROLE_GUEST or :ROLE_CAST (symbol) from protobuf ruby
        # TODO: MVP Logic. Implement verify/invite flow for Casts. Currently allows self-registration.
        role_str = role_enum == :ROLE_CAST ? 'cast' : 'guest'

        result = register_service.call(email: request.email, password: request.password, role: role_str)

        role_proto = result[:user_profile][:role] == 'cast' ? :ROLE_CAST : :ROLE_GUEST

        ::Identity::V1::RegisterResponse.new(
          access_token: result[:access_token],
          user_profile: ::Identity::V1::UserProfile.new(
            id: result[:user_profile][:id],
            email: result[:user_profile][:email],
            role: role_proto
          )
        )
      rescue => e
        # TODO: Map specific domain errors (e.g. EmailAlreadyExists) to proper gRPC status codes (ALREADY_EXISTS)
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INTERNAL, "Registration failed: #{e.message}")
      end

      def login(request, _call)
        result = login_service.call(email: request.email, password: request.password)

        if result
          role_proto = result[:user_profile][:role] == 'cast' ? :ROLE_CAST : :ROLE_GUEST
          ::Identity::V1::LoginResponse.new(
            access_token: result[:access_token],
            user_profile: ::Identity::V1::UserProfile.new(
              id: result[:user_profile][:id],
              email: result[:user_profile][:email],
              role: role_proto
            )
          )
        else
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Invalid credentials")
        end
      end
    end
  end
end
