require 'identity/v1/service_services_pb'
require 'gruf'

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
      rpc :ResetPassword, ::Identity::V1::ResetPasswordRequest, ::Identity::V1::ResetPasswordResponse
      rpc :GetCurrentAccount, ::Google::Protobuf::Empty, ::Identity::V1::Account

      include Identity::Deps[
        login_uc: "use_cases.auth.login",
        logout_uc: "use_cases.auth.logout",
        register_uc: "use_cases.auth.register",
        reset_password_uc: "use_cases.auth.reset_password",
        refresh_token_uc: "use_cases.token.refresh",
        send_code_uc: "use_cases.verification.send_code",
        verify_code_uc: "use_cases.verification.verify_code",
        get_profile_uc: "use_cases.user.get_profile"
      ]

      def health_check
        ::Identity::V1::HealthCheckResponse.new(status: "serving")
      end

      def send_sms
        send_code_uc.call(phone_number: request.message.phone_number)
        ::Identity::V1::SendSmsResponse.new(success: true)
      end

      def verify_sms
        result = verify_code_uc.call(phone_number: request.message.phone_number, code: request.message.code)

        unless result[:success]
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, "Invalid code or expired")
        end

        ::Identity::V1::VerifySmsResponse.new(verification_token: result[:verification_token])
      end

      def register
        role_int = AccountPresenter.role_enum_to_int(request.message.role) || 1

        result = register_uc.call(
          phone_number: request.message.phone_number,
          password: request.message.password,
          verification_token: request.message.verification_token,
          role: role_int
        )

        AuthPresenter.to_register_response(result)
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def login
        role_int = AccountPresenter.role_enum_to_int(request.message.role)

        result = login_uc.call(
          phone_number: request.message.phone_number,
          password: request.message.password,
          role: role_int
        )

        if result
          AuthPresenter.to_login_response(result)
        else
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Invalid credentials or role mismatch")
        end
      rescue Errors::ValidationError => e
        raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::INVALID_ARGUMENT, e.message)
      end

      def refresh_token
        result = refresh_token_uc.call(refresh_token: request.message.refresh_token)

        unless result
          raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Invalid or expired refresh token")
        end

        AuthPresenter.to_refresh_response(result)
      end

      def logout
        logout_uc.call(refresh_token: request.message.refresh_token)
        ::Identity::V1::LogoutResponse.new(success: true)
      end

      def reset_password
        result = reset_password_uc.call(
          phone_number: request.message.phone_number,
          new_password: request.message.new_password,
          verification_token: request.message.verification_token
        )
        ::Identity::V1::ResetPasswordResponse.new(success: result[:success])
      rescue Identity::UseCases::Auth::ResetPassword::ResetError => e
        raise GRPC::InvalidArgument, e.message
      end

      def get_current_account
        user_id = ::Current.user_id

        unless user_id
           raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::UNAUTHENTICATED, "Unauthenticated")
        end

        result = get_profile_uc.call(user_id: user_id)

        unless result
           raise GRPC::BadStatus.new(GRPC::Core::StatusCodes::NOT_FOUND, "User not found")
        end

        AccountPresenter.to_proto(result)
      end

      private

      AccountPresenter = Identity::Presenters::AccountPresenter
      AuthPresenter = Identity::Presenters::AuthPresenter
    end
  end
end
