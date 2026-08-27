# frozen_string_literal: true

require_relative "adapter"

module Cognito
  class AwsAdapter < Adapter
    def initialize(client: nil, user_pool_id: ENV.fetch("COGNITO_USER_POOL_ID"), region: ENV.fetch("COGNITO_REGION", "ap-northeast-1"))
      require "aws-sdk-cognitoidentityprovider"
      @client = client || Aws::CognitoIdentityProvider::Client.new(region: region)
      @user_pool_id = user_pool_id
    end

    def admin_delete_user(sub:)
      @client.admin_delete_user(user_pool_id: @user_pool_id, username: sub)
      true
    rescue Aws::CognitoIdentityProvider::Errors::UserNotFoundException
      # idempotent: already gone from Cognito is the desired end state
      true
    end
  end
end
