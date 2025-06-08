require_relative '../interfaces/gateways/file_gateway'

class FileSystemClient < FileGateway
  def get_changed_files(base_ref: nil, head_ref: nil)
    if base_ref && head_ref
      `git diff --name-only #{base_ref}...#{head_ref}`.strip.split("\n").reject(&:empty?)
    elsif base_ref
      `git diff --name-only #{base_ref}`.strip.split("\n").reject(&:empty?)
    else
      `git diff --name-only HEAD~1..HEAD`.strip.split("\n").reject(&:empty?)
    end
  rescue => error
    raise "Failed to get changed files: #{error.message}"
  end

  def directory_exists?(path)
    File.directory?(path)
  end

  def file_exists?(path)
    File.exist?(path)
  end
end
