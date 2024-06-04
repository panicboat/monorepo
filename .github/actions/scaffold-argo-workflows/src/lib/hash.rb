class Hash
  def self.deep_symbolize_keys(hash)
    data = hash.dup
    Hash.deep_transform_keys!(data, &:to_sym)
    data
  end
  
  def self.deep_transform_keys(object, &block)
    data = object.dup
    Hash.deep_transform_keys!(data, &block)
    data
  end
  
  def self.deep_transform_keys!(object, &block)
    case object
    when Hash
      object.keys.each do |key|
        value = object.delete(key)
        object[yield(key)] = deep_transform_keys!(value, &block)
      end
      object
    when Array
      object.map! { |e| deep_transform_keys!(e, &block) }
    else
      object
    end
  end

end
