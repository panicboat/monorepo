module Current
  def self.user_id=(id)
    Thread.current[:monolith_current_user_id] = id
  end

  def self.user_id
    Thread.current[:monolith_current_user_id]
  end

  def self.clear
    Thread.current[:monolith_current_user_id] = nil
  end
end
