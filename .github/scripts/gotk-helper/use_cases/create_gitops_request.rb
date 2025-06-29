# Use case for creating GitOps request based on PR deployment target
# Orchestrates GitOps request creation for kubernetes service found in PR

module UseCases
  module GitOpsManagement
    class CreateGitOpsRequest
      def initialize(
        process_gitops_request_use_case:,
        create_pull_request_use_case:
      )
        @process_gitops_request_use_case = process_gitops_request_use_case
        @create_pull_request_use_case = create_pull_request_use_case
      end

      # Execute GitOps request creation for specific service in PR
      def execute(
        pr_number:,
        manifest_file_path:,
        target_repository:,
        target_branch:,
        service_name: nil,
        environment: nil
      )
        # Validate required parameters
        unless service_name && environment
          return Entities::Result.failure(error_message: "service_name and environment are required")
        end

        source_repository = ENV['GITHUB_REPOSITORY']
        source_sha = ENV['GITHUB_SHA']

        # Create deployment target entity
        target = Entities::DeploymentTarget.new(
          service: service_name,
          environment: environment,
          stack: 'kubernetes',
          working_directory: "#{environment}/#{service_name}",
        )

        # Create GitOps request for this target
        request = Entities::GitOpsRequest.from_deployment_target(
          target,
          manifest_file_path: manifest_file_path,
          target_repository: target_repository,
          target_branch: target_branch,
          source_sha: source_sha,
          source_repository: source_repository,
          pr_number: pr_number
        )

        # Process GitOps request for this service/environment
        update_result = @process_gitops_request_use_case.execute(request)
        unless update_result.success?
          return Entities::Result.failure(
            error_message: "GitOps request failed for #{service_name}:#{environment} - #{update_result.error_message}"
          )
        end

        has_changes = update_result.data[:has_changes]

        # Create pull request if there are changes
        pr_result = @create_pull_request_use_case.execute(request, has_changes: has_changes)

        unless pr_result.success?
          return Entities::Result.failure(
            error_message: "Pull request creation failed for #{service_name}:#{environment} - #{pr_result.error_message}"
          )
        end

        Entities::Result.success(
          pr_number: pr_number,
          service: service_name,
          environment: environment,
          has_changes: has_changes,
          pull_request_url: pr_result.pull_request_url
        )
      rescue => e
        Entities::Result.failure(error_message: "Failed to create GitOps request from PR: #{e.message}")
      end
    end
  end
end
