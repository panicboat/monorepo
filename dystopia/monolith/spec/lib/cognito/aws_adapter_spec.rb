# frozen_string_literal: true

require "spec_helper"
require "aws-sdk-cognitoidentityprovider"
require "cognito/aws_adapter"

RSpec.describe Cognito::AwsAdapter do
  let(:client) { Aws::CognitoIdentityProvider::Client.new(stub_responses: true, region: "ap-northeast-1") }
  let(:adapter) { described_class.new(client: client, user_pool_id: "pool-1") }
  let(:sub) { "0199f0a0-0000-7000-8000-000000000001" }
  let(:username) { "0123456789abcdef" * 4 }

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

  describe "#find_user" do
    let(:created_at) { Time.utc(2026, 10, 27, 1, 2, 3) }

    it "looks the user up by username and builds a Cognito::User" do
      client.stub_responses(
        :list_users,
        users: [{
          username: username,
          attributes: [{ name: "phone_number", value: "+819012345678" }, { name: "sub", value: sub }],
          user_status: "UNCONFIRMED",
          user_create_date: created_at
        }]
      )

      expect(adapter.find_user(username: username)).to eq(
        Cognito::User.new(username: username, sub: sub, status: "UNCONFIRMED", created_at: created_at)
      )
      expect(requests(:list_users).map { |r| r[:params] }).to eq(
        [{ user_pool_id: "pool-1", filter: "username = \"#{username}\"", limit: 1 }]
      )
    end

    it "returns nil when no user has the username" do
      client.stub_responses(:list_users, users: [])

      expect(adapter.find_user(username: username)).to be_nil
    end

    it "raises when the lookup returns no users but has a next page" do
      client.stub_responses(:list_users, users: [], pagination_token: "next")

      expect { adapter.find_user(username: username) }.to raise_error(described_class::LookupIncompleteError)
    end

    it "rejects a username that is not a SHA-256 hex digest" do
      expect { adapter.find_user(username: "not-a-hash") }.to raise_error(ArgumentError)
      expect { adapter.find_user(username: "#{username[0, 63]}\" or username = \"x") }.to raise_error(ArgumentError)
      expect(client.api_requests).to be_empty
    end
  end

  describe "#delete_user" do
    it "deletes the user by username" do
      expect(adapter.delete_user(username: username)).to be(true)

      expect(requests(:admin_delete_user).map { |r| r[:params] }).to eq(
        [{ user_pool_id: "pool-1", username: username }]
      )
      expect(requests(:list_users)).to be_empty
    end

    it "returns true when the user is already absent" do
      client.stub_responses(:admin_delete_user, "UserNotFoundException")

      expect(adapter.delete_user(username: username)).to be(true)
    end

    it "raises when the deletion fails" do
      client.stub_responses(:admin_delete_user, "AccessDeniedException")

      expect { adapter.delete_user(username: username) }
        .to raise_error(Aws::CognitoIdentityProvider::Errors::AccessDeniedException)
    end

    it "rejects a username that is not a SHA-256 hex digest" do
      expect { adapter.delete_user(username: "not-a-hash") }.to raise_error(ArgumentError)
      expect(client.api_requests).to be_empty
    end
  end

  describe "#each_user" do
    it "yields the users of every page" do
      client.stub_responses(
        :list_users,
        [
          { users: [{ username: "u1", attributes: [{ name: "sub", value: "s1" }], user_status: "CONFIRMED" }], pagination_token: "page-2" },
          { users: [{ username: "u2", attributes: [{ name: "sub", value: "s2" }], user_status: "UNCONFIRMED" }] }
        ]
      )

      users = []
      adapter.each_user { |user| users << user }

      expect(users.map { |u| [u.username, u.sub, u.status] }).to eq([%w[u1 s1 CONFIRMED], %w[u2 s2 UNCONFIRMED]])
      expect(requests(:list_users).map { |r| r[:params] }).to eq(
        [{ user_pool_id: "pool-1" }, { user_pool_id: "pool-1", pagination_token: "page-2" }]
      )
    end
  end
end
