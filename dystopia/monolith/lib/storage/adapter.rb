# frozen_string_literal: true

module Storage
  class Adapter
    def upload_url(key:, content_type:)
      raise NotImplementedError, "#{self.class}#upload_url must be implemented"
    end

    def download_url(key:)
      raise NotImplementedError, "#{self.class}#download_url must be implemented"
    end

    def delete(key:)
      raise NotImplementedError, "#{self.class}#delete must be implemented"
    end
  end
end
