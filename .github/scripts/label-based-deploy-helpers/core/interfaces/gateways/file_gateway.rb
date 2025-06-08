class FileGateway
  def get_changed_files(base_ref: nil, head_ref: nil)
    raise NotImplementedError
  end

  def directory_exists?(path)
    raise NotImplementedError
  end

  def file_exists?(path)
    raise NotImplementedError
  end
end
