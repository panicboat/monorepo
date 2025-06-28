# Use case for extracting deployment information from PR using shared logic
# Leverages existing deploy-trigger components to determine services and environment

module UseCases
  module ManifestManagement
    class ExtractDeploymentInfo
      def initialize(get_pr_labels_use_case:, determine_environment_use_case:, generate_matrix_use_case:)
        @get_pr_labels_use_case = get_pr_labels_use_case
        @determine_environment_use_case = determine_environment_use_case
        @generate_matrix_use_case = generate_matrix_use_case
      end

      # Execute deployment information extraction from PR
      def execute(pr_number:, target_branch:)
        # Get PR labels and deploy information
        pr_result = @get_pr_labels_use_case.execute(pr_number: pr_number)
        return pr_result unless pr_result.success?

        deploy_labels = pr_result.data[:deploy_labels]
        return Entities::Result.failure(error_message: "No deploy labels found in PR") if deploy_labels.empty?

        # Determine target environment from branch
        env_result = @determine_environment_use_case.execute(branch_name: target_branch)
        return env_result unless env_result.success?

        target_environment = env_result.data[:target_environment]

        # Generate deployment matrix to get kubernetes targets
        matrix_result = @generate_matrix_use_case.execute(
          deploy_labels: deploy_labels,
          target_environment: target_environment
        )
        return matrix_result unless matrix_result.success?

        # Filter for kubernetes stack only
        kubernetes_targets = matrix_result.data[:deployment_targets].select do |target|
          target.stack == 'kubernetes'
        end

        if kubernetes_targets.empty?
          return Entities::Result.failure(
            error_message: "No kubernetes deployment targets found for PR ##{pr_number}"
          )
        end

        Entities::Result.success(
          pr_number: pr_number,
          deploy_labels: deploy_labels,
          target_environment: target_environment,
          kubernetes_targets: kubernetes_targets,
          source_branch: pr_result.data[:source_branch],
          source_sha: pr_result.data[:head_sha]
        )
      rescue => e
        Entities::Result.failure(error_message: "Failed to extract deployment info: #{e.message}")
      end
    end
  end
end