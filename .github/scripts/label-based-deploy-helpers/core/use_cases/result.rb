class Result
  attr_reader :data, :error_message

  def initialize(success:, data: {}, error_message: nil)
    @success = success
    @data = data
    @error_message = error_message
  end

  def self.success(**data)
    new(success: true, data: data)
  end

  def self.failure(error_message:)
    new(success: false, error_message: error_message)
  end

  def success?
    @success
  end

  def failure?
    !@success
  end

  def method_missing(method_name, *args, &block)
    if data.key?(method_name)
      data[method_name]
    else
      super
    end
  end

  def respond_to_missing?(method_name, include_private = false)
    data.key?(method_name) || super
  end
end
