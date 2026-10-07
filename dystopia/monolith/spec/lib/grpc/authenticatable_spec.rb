# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "lib/grpc/authenticatable"

RSpec.describe Grpc::Authenticatable do
  subject(:host) { Class.new { include Grpc::Authenticatable }.new }

  after { Current.clear }

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  describe "#authenticate_account!" do
    it "raises UNAUTHENTICATED without an account" do
      expect { host.authenticate_account! }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end

    it "passes with an account even when no profile is active" do
      Current.account_id = "acc-1"

      expect { host.authenticate_account! }.not_to raise_error
    end
  end

  describe "#authenticate_user!" do
    it "raises UNAUTHENTICATED without an account" do
      expect { host.authenticate_user! }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end

    it "raises FAILED_PRECONDITION with an account but no active profile" do
      Current.account_id = "acc-1"

      expect { host.authenticate_user! }.to status(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
    end

    it "passes with an account and an active profile" do
      Current.account_id = "acc-1"
      Current.profile_id = "prof-1"

      expect { host.authenticate_user! }.not_to raise_error
    end
  end

  it "exposes the account and the profile separately" do
    Current.account_id = "acc-1"
    Current.profile_id = "prof-1"

    expect(host.current_account_id).to eq("acc-1")
    expect(host.current_profile_id).to eq("prof-1")
  end

  it "returns the profile id from current_user_id" do
    Current.account_id = "acc-1"
    Current.profile_id = "prof-1"

    expect(host.current_user_id).to eq("prof-1")
  end
end
