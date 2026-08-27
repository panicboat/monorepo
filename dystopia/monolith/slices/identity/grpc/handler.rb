# frozen_string_literal: true

require "identity/v1/service_services_pb"
require "gruf"

module Identity
  module Grpc
    class Handler < Gruf::Controllers::Base
      include GRPC::GenericService
      self.marshal_class_method = :encode
      self.unmarshal_class_method = :decode
      self.service_name = "identity.v1.IdentityService"

      bind ::Identity::V1::IdentityService::Service

      self.rpc_descs.clear

      rpc :HealthCheck, ::Identity::V1::HealthCheckRequest, ::Identity::V1::HealthCheckResponse
      rpc :CreateAccount, ::Identity::V1::CreateAccountRequest, ::Identity::V1::CreateAccountResponse
      rpc :GetAccount, ::Identity::V1::GetAccountRequest, ::Identity::V1::GetAccountResponse
      rpc :DeactivateAccount, ::Identity::V1::DeactivateAccountRequest, ::Identity::V1::DeactivateAccountResponse
      rpc :ReactivateAccount, ::Identity::V1::ReactivateAccountRequest, ::Identity::V1::ReactivateAccountResponse

      include Identity::Deps[
        create_account_uc: "use_cases.account.create_account",
        get_account_uc: "use_cases.account.get_account",
        deactivate_account_uc: "use_cases.account.deactivate_account",
        reactivate_account_uc: "use_cases.account.reactivate_account"
      ]

      def health_check
        Identity::V1::HealthCheckResponse.new(status: "ok")
      end

      def create_account
        role = Identity::Presenters::AccountPresenter.role_enum_to_int(request.message.role)
        role = 1 if role.nil? || role.zero? # SILENT: legacy fallback to Guest for unspecified/unknown roles
        account = create_account_uc.call(sub: request.message.sub, role: role)

        Identity::V1::CreateAccountResponse.new(
          account: Identity::Presenters::AccountPresenter.to_proto(account)
        )
      rescue Identity::UseCases::Account::CreateAccount::AccountAlreadyExists
        raise GRPC::AlreadyExists.new("account already exists")
      end

      def get_account
        account = get_account_uc.call(sub: request.message.sub)
        raise GRPC::NotFound.new("account not found") unless account

        Identity::V1::GetAccountResponse.new(
          account: Identity::Presenters::AccountPresenter.to_proto(account)
        )
      end

      def deactivate_account
        sub = Current.user_id
        raise GRPC::Unauthenticated.new("no current user") unless sub

        deactivate_account_uc.call(sub: sub)
        Identity::V1::DeactivateAccountResponse.new
      end

      def reactivate_account
        account = reactivate_account_uc.call(sub: request.message.sub)
        raise GRPC::NotFound.new("account not found") unless account

        Identity::V1::ReactivateAccountResponse.new(
          account: Identity::Presenters::AccountPresenter.to_proto(account)
        )
      end
    end
  end
end
