module Current
  def self.user_id=(id)
    Thread.current[:monolith_current_user_id] = id
  end

  def self.user_id
    Thread.current[:monolith_current_user_id]
  end

  def self.request_id=(id)
    Thread.current[:monolith_current_request_id] = id
  end

  def self.request_id
    Thread.current[:monolith_current_request_id]
  end

  def self.clear
    Thread.current[:monolith_current_user_id] = nil
    Thread.current[:monolith_current_request_id] = nil
  end
end
