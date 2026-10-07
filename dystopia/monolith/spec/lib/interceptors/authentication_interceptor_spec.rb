# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "lib/interceptors/authentication_interceptor"

RSpec.describe Interceptors::AuthenticationInterceptor, type: :database do
  let(:interceptor) { described_class.new(request, error) }
  let(:request) { double(:request, metadata: metadata, context: {}) }
  let(:error) { double(:error) }
  let(:metadata) { {} }
  let(:account_id) { create_account(role: 2) }

  def permission_denied
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::PERMISSION_DENIED) }
  end

  describe "#call" do
    context "when x-user-id metadata is absent" do
      it "leaves the account and the profile empty" do
        interceptor.call do
          expect(Current.account_id).to be_nil
          expect(Current.profile_id).to be_nil
        end
      end
    end

    context "with an Authorization: Bearer header only" do
      let(:metadata) { { "authorization" => "Bearer anything" } }

      it "does not extract an account from Bearer" do
        interceptor.call { expect(Current.account_id).to be_nil }
      end
    end

    context "when x-user-id is present without x-profile-id" do
      let(:metadata) { { "x-user-id" => account_id } }

      it "resolves the only enabled profile of the account" do
        profile_id = create_account_with_profile(account_id: account_id)

        interceptor.call do
          expect(Current.account_id).to eq(account_id)
          expect(Current.profile_id).to eq(profile_id)
        end
      end

      it "ignores disabled profiles when resolving the only enabled one" do
        enabled = create_account_with_profile(account_id: account_id)
        create_account_with_profile(account_id: account_id, disabled_at: Time.now)

        interceptor.call { expect(Current.profile_id).to eq(enabled) }
      end

      it "leaves the profile empty when the account has several enabled profiles" do
        create_account_with_profile(account_id: account_id)
        create_account_with_profile(account_id: account_id)

        interceptor.call do
          expect(Current.account_id).to eq(account_id)
          expect(Current.profile_id).to be_nil
        end
      end

      it "leaves the profile empty when the account has no profile" do
        interceptor.call { expect(Current.profile_id).to be_nil }
      end
    end

    context "when x-user-id is not a UUID" do
      let(:metadata) { { "x-user-id" => "sub-1" } }

      it "keeps the account and resolves no profile" do
        interceptor.call do
          expect(Current.account_id).to eq("sub-1")
          expect(Current.profile_id).to be_nil
        end
      end
    end

    context "when x-profile-id is present" do
      let(:metadata) { { "x-user-id" => account_id, "x-profile-id" => requested } }
      let(:own_profile) { create_account_with_profile(account_id: account_id) }

      context "and it is an enabled profile of the account" do
        let(:requested) { own_profile }

        it "uses the requested profile even when the account has several" do
          create_account_with_profile(account_id: account_id)

          interceptor.call { expect(Current.profile_id).to eq(own_profile) }
        end
      end

      context "and it belongs to another account" do
        let(:requested) { create_account_with_profile }

        it "rejects the call" do
          expect { interceptor.call {} }.to permission_denied
        end
      end

      context "and it is disabled" do
        let(:requested) { create_account_with_profile(account_id: account_id, disabled_at: Time.now) }

        it "rejects the call" do
          expect { interceptor.call {} }.to permission_denied
        end
      end

      context "and it does not exist" do
        let(:requested) { SecureRandom.uuid_v7 }

        it "rejects the call" do
          expect { interceptor.call {} }.to permission_denied
        end
      end

      context "and it is not a UUID" do
        let(:requested) { "'; DROP TABLE profiles; --" }

        it "rejects the call without a database error" do
          expect { interceptor.call {} }.to permission_denied
        end
      end

      context "and it is an empty string" do
        let(:requested) { "" }

        it "falls back to the only enabled profile" do
          own_profile

          interceptor.call { expect(Current.profile_id).to eq(own_profile) }
        end
      end
    end

    it "propagates or generates a request id" do
      interceptor.call { expect(Current.request_id).not_to be_nil }
    end

    it "clears Current after the block" do
      interceptor.call {}

      expect(Current.account_id).to be_nil
      expect(Current.profile_id).to be_nil
      expect(Current.request_id).to be_nil
    end

    context "when the call is rejected" do
      let(:metadata) { { "x-user-id" => account_id, "x-profile-id" => SecureRandom.uuid_v7 } }

      it "still clears Current" do
        expect { interceptor.call {} }.to raise_error(GRPC::BadStatus)

        expect(Current.account_id).to be_nil
      end
    end
  end
end
