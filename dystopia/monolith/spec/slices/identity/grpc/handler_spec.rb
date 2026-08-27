# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/identity/grpc/handler"

RSpec.describe Identity::Grpc::Handler do
  let(:handler) do
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: message,
      create_account_uc: create_account_uc,
      get_account_uc: get_account_uc,
      deactivate_account_uc: deactivate_account_uc,
      reactivate_account_uc: reactivate_account_uc
    )
  end
  let(:message) { double(:message) }
  let(:create_account_uc) { double(:create_account_uc) }
  let(:get_account_uc) { double(:get_account_uc) }
  let(:deactivate_account_uc) { double(:deactivate_account_uc) }
  let(:reactivate_account_uc) { double(:reactivate_account_uc) }

  after { Current.clear }

  describe "#health_check" do
    it "returns status ok" do
      response = handler.health_check

      expect(response).to be_a(Identity::V1::HealthCheckResponse)
      expect(response.status).to eq("ok")
    end
  end

  describe "#create_account" do
    let(:message) { Identity::V1::CreateAccountRequest.new(sub: "sub-1", role: :ROLE_GUEST) }

    it "creates an account and returns it in the response wrapper" do
      account = Struct.new(:id, :role, :deactivated_at).new("sub-1", 1, nil)
      expect(create_account_uc).to receive(:call).with(sub: "sub-1", role: 1).and_return(account)

      response = handler.create_account

      expect(response).to be_a(Identity::V1::CreateAccountResponse)
      expect(response.account.id).to eq("sub-1")
      expect(response.account.role).to eq(:ROLE_GUEST)
    end

    it "returns ALREADY_EXISTS when the account exists" do
      allow(create_account_uc).to receive(:call)
        .and_raise(Identity::UseCases::Account::CreateAccount::AccountAlreadyExists)

      expect { handler.create_account }.to raise_error(GRPC::AlreadyExists, /account already exists/)
    end

    it "uses Guest for an unspecified role" do
      request = double(:request, message: Identity::V1::CreateAccountRequest.new(sub: "sub-1", role: :ROLE_UNSPECIFIED))
      account = Struct.new(:id, :role, :deactivated_at).new("sub-1", 1, nil)
      expect(create_account_uc).to receive(:call).with(sub: "sub-1", role: 1).and_return(account)
      handler.instance_variable_set(:@request, request)

      handler.create_account
    end
  end

  describe "#get_account" do
    let(:message) { Identity::V1::GetAccountRequest.new(sub: "sub-1") }

    it "returns the account in the response wrapper when found" do
      account = Struct.new(:id, :role, :deactivated_at).new("sub-1", 2, nil)
      expect(get_account_uc).to receive(:call).with(sub: "sub-1").and_return(account)

      response = handler.get_account

      expect(response).to be_a(Identity::V1::GetAccountResponse)
      expect(response.account.role).to eq(:ROLE_CAST)
    end

    it "raises NOT_FOUND when missing" do
      allow(get_account_uc).to receive(:call).with(sub: "sub-1").and_return(nil)

      expect { handler.get_account }.to raise_error(GRPC::NotFound, /account not found/)
    end
  end

  describe "#deactivate_account" do
    it "deactivates the current user's account" do
      Current.user_id = "sub-1"
      expect(deactivate_account_uc).to receive(:call).with(sub: "sub-1")

      response = handler.deactivate_account

      expect(response).to be_a(Identity::V1::DeactivateAccountResponse)
    end

    it "raises UNAUTHENTICATED without a current user" do
      expect { handler.deactivate_account }.to raise_error(GRPC::Unauthenticated, /no current user/)
    end
  end

  describe "#reactivate_account" do
    let(:message) { Identity::V1::ReactivateAccountRequest.new(sub: "sub-1") }

    it "reactivates an account and returns it in the response wrapper" do
      account = Struct.new(:id, :role, :deactivated_at).new("sub-1", 1, nil)
      expect(reactivate_account_uc).to receive(:call).with(sub: "sub-1").and_return(account)

      response = handler.reactivate_account

      expect(response).to be_a(Identity::V1::ReactivateAccountResponse)
      expect(response.account.id).to eq("sub-1")
    end

    it "raises NOT_FOUND when the account is missing" do
      allow(reactivate_account_uc).to receive(:call).with(sub: "sub-1").and_return(nil)

      expect { handler.reactivate_account }.to raise_error(GRPC::NotFound, /account not found/)
    end
  end
end
