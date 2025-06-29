# Use case for processing GitOps requests in target repository
# Handles the core logic of creating feature branch, updating files, and committing changes

module UseCases
  module GitOpsManagement
    class ProcessGitOpsRequest
      def initialize(file_client:)
        @file_client = file_client
      end

      # Execute GitOps request operation in target repository
      def execute(request)
        return Entities::Result.failure(error_message: "Invalid GitOps request") unless request.valid?

        begin
          # Configure Git user identity
          configure_git_result = configure_git_identity
          return configure_git_result unless configure_git_result.success?

          # Read manifest content from source file
          manifest_content = @file_client.read_file(request.manifest_file_path)
          return Entities::Result.failure(error_message: "Failed to read manifest file") if manifest_content.nil?

          # Create feature branch
          create_feature_branch_result = create_feature_branch(request)
          return create_feature_branch_result unless create_feature_branch_result.success?

          # Update manifest file in target repository
          update_file_result = write_manifest_file(request, manifest_content)
          return update_file_result unless update_file_result.success?

          # Check for changes and commit if necessary
          commit_result = commit_changes(request)
          return commit_result unless commit_result.success?
          
          Entities::Result.success(has_changes: commit_result.data[:has_changes])
        rescue => e
          Entities::Result.failure(error_message: "GitOps request processing failed: #{e.message}")
        end
      end

      private

      # Configure Git user identity for commits
      def configure_git_identity
        begin
          @file_client.execute_command("git config user.name 'panicboat'")
          @file_client.execute_command("git config user.email 'panicboat@gmail.com'")
          Entities::Result.success
        rescue => e
          Entities::Result.failure(error_message: "Failed to configure Git identity: #{e.message}")
        end
      end

      # Create and switch to feature branch
      def create_feature_branch(request)
        begin
          @file_client.execute_command("git checkout -b #{request.feature_branch_name}")
          Entities::Result.success
        rescue => e
          Entities::Result.failure(error_message: "Failed to create feature branch: #{e.message}")
        end
      end

      # Write manifest file with new content
      def write_manifest_file(request, manifest_content)
        begin
          # Create environment directory if it doesn't exist
          env_dir = request.environment
          @file_client.create_directory(env_dir) unless @file_client.directory_exists?(env_dir)

          # Write manifest content to target file
          @file_client.write_file(request.target_file_path, manifest_content)
          
          # Stage the file for commit
          @file_client.execute_command("git add #{request.target_file_path}")
          
          Entities::Result.success
        rescue => e
          Entities::Result.failure(error_message: "Failed to write manifest file: #{e.message}")
        end
      end

      # Commit changes if any exist
      def commit_changes(request)
        begin
          # Check if there are changes to commit
          diff_output = @file_client.execute_command("git diff --cached --quiet")
          has_changes = !diff_output[:success]

          if has_changes
            @file_client.execute_command(%Q(git commit -m "#{request.commit_message}"))
            Entities::Result.success(has_changes: true)
          else
            Entities::Result.success(has_changes: false)
          end
        rescue => e
          Entities::Result.failure(error_message: "Failed to commit changes: #{e.message}")
        end
      end
    end
  end
end