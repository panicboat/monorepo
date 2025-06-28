# Use case for creating pull requests in GitOps repository
# Handles pushing feature branch and creating pull request with auto-merge

module UseCases
  module ManifestManagement
    class CreatePullRequest
      def initialize(github_client:, file_client:)
        @github_client = github_client
        @file_client = file_client
      end

      # Execute pull request creation with auto-merge enabled
      def execute(request, has_changes:)
        return Entities::PullRequestResult.no_changes unless has_changes

        begin
          # Push feature branch to remote repository
          push_result = push_feature_branch(request)
          return Entities::PullRequestResult.failure(error_message: push_result.message) unless push_result.success?

          # Create pull request with labels
          pr_result = create_pull_request_with_labels(request)
          return Entities::PullRequestResult.failure(error_message: pr_result.message) unless pr_result.success?

          pull_request_url = pr_result.data[:pull_request_url]

          # Enable auto-merge with squash
          auto_merge_result = enable_auto_merge(pull_request_url)
          return Entities::PullRequestResult.failure(error_message: auto_merge_result.message) unless auto_merge_result.success?

          Entities::PullRequestResult.success(
            pull_request_url: pull_request_url,
            has_changes: true
          )
        rescue => e
          Entities::PullRequestResult.failure(error_message: "Pull request creation failed: #{e.message}")
        end
      end

      private

      # Push feature branch to remote repository
      def push_feature_branch(request)
        begin
          @file_client.execute_command("git push origin #{request.feature_branch_name}")
          Entities::Result.success
        rescue => e
          Entities::Result.failure("Failed to push feature branch: #{e.message}")
        end
      end

      # Create pull request with appropriate labels
      def create_pull_request_with_labels(request)
        begin
          pr_body = generate_pull_request_body(request)
          
          pull_request_url = @github_client.create_pull_request(
            repository: request.target_repository,
            base: request.target_branch,
            head: request.feature_branch_name,
            title: request.pull_request_title,
            body: pr_body,
            labels: [
              "environment:#{request.environment}",
              "service:#{request.service}",
              "auto-generated"
            ]
          )

          Entities::Result.success(pull_request_url: pull_request_url)
        rescue => e
          Entities::Result.failure("Failed to create pull request: #{e.message}")
        end
      end

      # Enable auto-merge with squash strategy
      def enable_auto_merge(pull_request_url)
        begin
          @github_client.enable_auto_merge(pull_request_url, merge_method: 'squash')
          Entities::Result.success
        rescue => e
          Entities::Result.failure("Failed to enable auto-merge: #{e.message}")
        end
      end

      # Generate detailed pull request body
      def generate_pull_request_body(request)
        pr_info_section = ""
        if request.pr_number
          pr_info_section = <<~PR_INFO
            
            ### Source Pull Request
            - **PR**: [##{request.pr_number}](https://github.com/#{request.source_repository}/pull/#{request.pr_number})
          PR_INFO
        end

        <<~BODY
          ## Automated Manifest Update

          **Service**: #{request.service}
          **Environment**: #{request.environment}
          **Source Repository**: #{request.source_repository}
          **Source Commit**: [#{request.source_sha}](https://github.com/#{request.source_repository}/commit/#{request.source_sha})
          **Generated File**: `#{request.target_file_path}`#{pr_info_section}

          ### Changes
          This PR contains automatically generated Kubernetes manifests based on the latest kustomize build.

          ### Source Details
          - **Branch**: #{request.target_branch}
          - **Workflow**: [GitHub Actions Run](#{ENV['GITHUB_SERVER_URL']}/#{request.source_repository}/actions/runs/#{ENV['GITHUB_RUN_ID']})

          ---
          *This PR was created automatically by the Kubernetes manifest generation workflow.*
        BODY
      end
    end
  end
end