# frozen_string_literal: true

require "spec_helper"
require "aws-sdk-cognitoidentityprovider"
require "cognito/aws_adapter"

RSpec.describe Cognito::AwsAdapter do
  let(:client) { Aws::CognitoIdentityProvider::Client.new(stub_responses: true, region: "ap-northeast-1") }
  let(:adapter) { described_class.new(client: client, user_pool_id: "pool-1") }
  let(:sub) { "0199f0a0-0000-7000-8000-000000000001" }

  def requests(operation_name)
    client.api_requests.select { |request| request[:operation_name] == operation_name }
  end

  describe "#admin_delete_user" do
    it "looks up the username by sub and deletes that user" do
      client.stub_responses(:list_users, users: [{ username: "hashed-phone" }])

      expect(adapter.admin_delete_user(sub: sub)).to be(true)

      expect(requests(:list_users).map { |r| r[:params] }).to eq(
        [{ user_pool_id: "pool-1", filter: "sub = \"#{sub}\"", limit: 1 }]
      )
      expect(requests(:admin_delete_user).map { |r| r[:params] }).to eq(
        [{ user_pool_id: "pool-1", username: "hashed-phone" }]
      )
    end

    it "returns true without deleting when no user has the sub" do
      client.stub_responses(:list_users, users: [])

      expect(adapter.admin_delete_user(sub: sub)).to be(true)
      expect(requests(:admin_delete_user)).to be_empty
    end

    it "returns true when the user disappears before the delete" do
      client.stub_responses(:list_users, users: [{ username: "hashed-phone" }])
      client.stub_responses(:admin_delete_user, "UserNotFoundException")

      expect(adapter.admin_delete_user(sub: sub)).to be(true)
    end

    it "raises without deleting when the lookup returns no users but has a next page" do
      client.stub_responses(:list_users, users: [], pagination_token: "next")

      expect { adapter.admin_delete_user(sub: sub) }.to raise_error(described_class::LookupIncompleteError)
      expect(requests(:admin_delete_user)).to be_empty
    end

    it "raises when the lookup fails" do
      client.stub_responses(:list_users, "AccessDeniedException")

      expect { adapter.admin_delete_user(sub: sub) }
        .to raise_error(Aws::CognitoIdentityProvider::Errors::AccessDeniedException)
    end

    it "rejects a sub that is not a UUID" do
      expect { adapter.admin_delete_user(sub: "x\" or sub = \"y") }.to raise_error(ArgumentError)
      expect(client.api_requests).to be_empty
    end
  end
end
