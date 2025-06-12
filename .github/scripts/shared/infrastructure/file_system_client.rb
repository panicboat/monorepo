# File system client for git operations and file/directory checks
# Handles file change detection and path validation

module Infrastructure
  class FileSystemClient
    # Get list of changed files using git diff
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

    # Check if directory exists
    def directory_exists?(path)
      File.directory?(path)
    end

    # Check if file exists
    def file_exists?(path)
      File.exist?(path)
    end

    # Get all directories matching a pattern
    def find_directories(pattern)
      Dir.glob(pattern).select { |path| File.directory?(path) }
    end

    # Get current git branch
    def current_branch
      `git branch --show-current`.strip
    rescue => error
      raise "Failed to get current branch: #{error.message}"
    end

    # Check if git repository is clean
    def git_clean?
      `git status --porcelain`.strip.empty?
    rescue => error
      raise "Failed to check git status: #{error.message}"
    end
  end
end
