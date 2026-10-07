module Current
  def self.account_id=(id)
    Thread.current[:monolith_current_account_id] = id
  end

  def self.account_id
    Thread.current[:monolith_current_account_id]
  end

  def self.profile_id=(id)
    Thread.current[:monolith_current_profile_id] = id
  end

  def self.profile_id
    Thread.current[:monolith_current_profile_id]
  end

  def self.profile_denied=(denied)
    Thread.current[:monolith_current_profile_denied] = !!denied
  end

  def self.profile_denied
    Thread.current[:monolith_current_profile_denied] || false
  end

  def self.request_id=(id)
    Thread.current[:monolith_current_request_id] = id
  end

  def self.request_id
    Thread.current[:monolith_current_request_id]
  end

  def self.clear
    Thread.current[:monolith_current_account_id] = nil
    Thread.current[:monolith_current_profile_id] = nil
    Thread.current[:monolith_current_profile_denied] = false
    Thread.current[:monolith_current_request_id] = nil
  end
end
