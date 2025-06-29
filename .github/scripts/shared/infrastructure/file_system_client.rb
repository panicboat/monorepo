# File system client for git operations and file/directory checks
# Handles file change detection and path validation

require 'fileutils'

module Infrastructure
  class FileSystemClient
    def initialize(working_directory: nil)
      @working_directory = working_directory
    end
    # Get list of changed files using git diff
    def get_changed_files(base_ref: nil, head_ref: nil)
      if base_ref && head_ref
        # Check if refs exist before using them
        unless ref_exists?(base_ref) && ref_exists?(head_ref)
          puts "Warning: One or both refs don't exist (#{base_ref}, #{head_ref}). Using current working tree changes."
          return get_current_changes
        end
        `git diff --name-only #{base_ref}...#{head_ref}`.strip.split("\n").reject(&:empty?)
      elsif base_ref
        unless ref_exists?(base_ref)
          puts "Warning: Base ref '#{base_ref}' doesn't exist. Using current working tree changes."
          return get_current_changes
        end
        `git diff --name-only #{base_ref}`.strip.split("\n").reject(&:empty?)
      else
        get_current_changes
      end
    rescue => error
      puts "Warning: Git diff failed: #{error.message}. Using current working tree changes."
      get_current_changes
    end

    # Read file content
    def read_file(file_path)
      File.read(file_path)
    rescue => error
      raise "Failed to read file #{file_path}: #{error.message}"
    end

    # Write content to file
    def write_file(file_path, content)
      File.write(resolve_path(file_path), content)
    rescue => error
      raise "Failed to write file #{file_path}: #{error.message}"
    end

    # Create directory if it doesn't exist
    def create_directory(dir_path)
      FileUtils.mkdir_p(resolve_path(dir_path))
    rescue => error
      raise "Failed to create directory #{dir_path}: #{error.message}"
    end

    # Execute shell command and return result
    def execute_command(command)
      result = with_working_directory { system(command) }
      { success: result, output: $?.to_s }
    rescue => error
      raise "Failed to execute command '#{command}': #{error.message}"
    end

    # Check if directory exists
    def directory_exists?(path)
      File.directory?(resolve_path(path))
    end

    # Check if file exists
    def file_exists?(path)
      File.exist?(resolve_path(path))
    end

    private

    # Resolve path based on working directory
    def resolve_path(path)
      @working_directory ? File.join(@working_directory, path) : path
    end

    # Execute block with working directory context
    def with_working_directory(&block)
      @working_directory ? Dir.chdir(@working_directory, &block) : block.call
    end

    # Check if a git reference exists
    def ref_exists?(ref)
      with_working_directory { system("git rev-parse --verify #{ref} >/dev/null 2>&1") }
    end

    # Get current working tree changes (staged + unstaged)
    def get_current_changes
      with_working_directory do
        # Get both staged and unstaged changes
        staged_files = `git diff --cached --name-only`.strip.split("\n").reject(&:empty?)
        unstaged_files = `git diff --name-only`.strip.split("\n").reject(&:empty?)

        # Combine and deduplicate
        (staged_files + unstaged_files).uniq
      end
    end

    # Get all directories matching a pattern
    def find_directories(pattern)
      Dir.glob(pattern).select { |path| File.directory?(path) }
    end

    # Get current git branch
    def current_branch
      with_working_directory { `git branch --show-current`.strip }
    rescue => error
      raise "Failed to get current branch: #{error.message}"
    end

    # Check if git repository is clean
    def git_clean?
      with_working_directory { `git status --porcelain`.strip.empty? }
    rescue => error
      raise "Failed to check git status: #{error.message}"
    end
  end
end
