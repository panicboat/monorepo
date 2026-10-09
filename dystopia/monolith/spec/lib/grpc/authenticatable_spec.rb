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
      expect { host.authenticate_account! }.to raise_error(GRPC::BadStatus) { |error|
        expect(error.code).to eq(GRPC::Core::StatusCodes::UNAUTHENTICATED)
        expect(error.metadata).not_to have_key("error-reason")
      }
    end

    it "passes with an account even when no profile is active" do
      Current.account_id = "acc-1"

      expect { host.authenticate_account! }.not_to raise_error
    end

    it "passes with an account when the requested profile is denied" do
      Current.account_id = "acc-1"
      Current.profile_denied = true

      expect { host.authenticate_account! }.not_to raise_error
    end
  end

  describe "#authenticate_user!" do
    it "raises UNAUTHENTICATED without an account" do
      expect { host.authenticate_user! }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
    end

    it "raises FAILED_PRECONDITION with an account but no active profile" do
      Current.account_id = "acc-1"

      expect { host.authenticate_user! }.to raise_error(GRPC::BadStatus) { |error|
        expect(error.code).to eq(GRPC::Core::StatusCodes::FAILED_PRECONDITION)
        expect(error.metadata["error-reason"]).to eq("profile_required")
      }
    end

    it "raises PERMISSION_DENIED when the requested profile is denied" do
      Current.account_id = "acc-1"
      Current.profile_denied = true

      expect { host.authenticate_user! }.to raise_error(GRPC::BadStatus) { |error|
        expect(error.code).to eq(GRPC::Core::StatusCodes::PERMISSION_DENIED)
        expect(error.metadata["error-reason"]).to eq("profile_not_permitted")
      }
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
end
