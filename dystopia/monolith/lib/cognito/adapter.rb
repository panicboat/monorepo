# frozen_string_literal: true

module Cognito
  User = Data.define(:username, :sub, :status, :created_at)

  USERNAME_PATTERN = /\A\h{64}\z/

  class Adapter
    def admin_delete_user(sub:)
      raise NotImplementedError
    end

    def find_user(username:)
      raise NotImplementedError
    end

    def delete_user(username:)
      raise NotImplementedError
    end

    def each_user
      raise NotImplementedError
    end
  end
end
