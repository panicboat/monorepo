# frozen_string_literal: true

require_relative "adapter"

module Cognito
  class AwsAdapter < Adapter
    class LookupIncompleteError < StandardError; end

    SUB_PATTERN = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

    def initialize(client: nil, user_pool_id: ENV.fetch("COGNITO_USER_POOL_ID"), region: ENV.fetch("COGNITO_REGION", "ap-northeast-1"))
      require "aws-sdk-cognitoidentityprovider"
      @client = client || Aws::CognitoIdentityProvider::Client.new(region: region)
      @user_pool_id = user_pool_id
    end

    def admin_delete_user(sub:)
      # The filter is interpolated into a Cognito query, so only a UUID may reach it.
      raise ArgumentError, "sub must be a UUID" unless SUB_PATTERN.match?(sub.to_s)

      # AdminDeleteUser takes the username or an alias, so look the username up by sub first.
      response = @client.list_users(user_pool_id: @user_pool_id, filter: %(sub = "#{sub}"), limit: 1)
      username = response.users.first&.username
      if username.nil?
        raise LookupIncompleteError, "Cognito user lookup for #{sub} did not finish" if response.pagination_token

        return true
      end

      @client.admin_delete_user(user_pool_id: @user_pool_id, username: username)
      true
    rescue Aws::CognitoIdentityProvider::Errors::UserNotFoundException
      # FALLBACK: Treat an already-absent Cognito user as success so deletion remains idempotent.
      true
    end

    def find_user(username:)
      validate_username!(username)

      response = @client.list_users(user_pool_id: @user_pool_id, filter: %(username = "#{username}"), limit: 1)
      user = response.users.first
      if user.nil?
        raise LookupIncompleteError, "Cognito user lookup by username did not finish" if response.pagination_token

        return nil
      end

      build_user(user)
    end

    def delete_user(username:)
      validate_username!(username)

      @client.admin_delete_user(user_pool_id: @user_pool_id, username: username)
      true
    rescue Aws::CognitoIdentityProvider::Errors::UserNotFoundException
      # FALLBACK: Treat an already-absent Cognito user as success so deletion remains idempotent.
      true
    end

    def each_user
      pagination_token = nil
      loop do
        params = { user_pool_id: @user_pool_id }
        params[:pagination_token] = pagination_token if pagination_token
        response = @client.list_users(params)
        response.users.each { |user| yield build_user(user) }
        pagination_token = response.pagination_token
        break if pagination_token.nil?
      end
    end

    private

    def validate_username!(username)
      # find_user interpolates the username into a Cognito filter, so only a hex digest may reach it.
      raise ArgumentError, "username must be a SHA-256 hex digest" unless USERNAME_PATTERN.match?(username.to_s)
    end

    def build_user(user)
      User.new(
        username: user.username,
        sub: user.attributes.find { |attribute| attribute.name == "sub" }&.value,
        status: user.user_status,
        created_at: user.user_create_date
      )
    end
  end
end
