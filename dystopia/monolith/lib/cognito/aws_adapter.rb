# frozen_string_literal: true

require_relative "adapter"

module Cognito
  class AwsAdapter < Adapter
    SUB_PATTERN = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

    def initialize(client: nil, user_pool_id: ENV.fetch("COGNITO_USER_POOL_ID"), region: ENV.fetch("COGNITO_REGION", "ap-northeast-1"))
      require "aws-sdk-cognitoidentityprovider"
      @client = client || Aws::CognitoIdentityProvider::Client.new(region: region)
      @user_pool_id = user_pool_id
    end

    def admin_delete_user(sub:)
      # The filter is interpolated into a Cognito query, so only a UUID may reach it.
      raise ArgumentError, "sub must be a UUID" unless SUB_PATTERN.match?(sub.to_s)

      # AdminDeleteUser needs the pool's Username (the phone hash), which the sub does not always resolve to.
      username = @client.list_users(user_pool_id: @user_pool_id, filter: %(sub = "#{sub}"), limit: 1).users.first&.username
      return true if username.nil?

      @client.admin_delete_user(user_pool_id: @user_pool_id, username: username)
      true
    rescue Aws::CognitoIdentityProvider::Errors::UserNotFoundException
      # FALLBACK: Treat an already-absent Cognito user as success so deletion remains idempotent.
      true
    end
  end
end
