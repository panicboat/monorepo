# Use case for extracting deployment information from workflow environment
# Uses information already provided by auto-label--deploy-trigger.yaml

module UseCases
  module ManifestManagement
    class ExtractDeploymentInfo
      def initialize
        # No dependencies needed - uses workflow environment variables
      end

      # Execute deployment information extraction from workflow environment
      def execute(pr_number:, target_branch:)
        # Get deployment information from workflow environment
        deployment_targets = parse_deployment_targets
        return Entities::Result.failure(error_message: "No deployment targets found in environment") if deployment_targets.empty?

        target_environment = ENV['TARGET_ENVIRONMENT']
        return Entities::Result.failure(error_message: "TARGET_ENVIRONMENT not set") unless target_environment

        # Filter for kubernetes stack only
        kubernetes_targets = deployment_targets.select do |target|
          target['stack'] == 'kubernetes'
        end

        if kubernetes_targets.empty?
          return Entities::Result.failure(
            error_message: "No kubernetes deployment targets found for PR ##{pr_number}"
          )
        end

        # Convert to deployment target entities
        target_entities = kubernetes_targets.map do |target|
          Entities::DeploymentTarget.new(
            service: target['service'],
            environment: target['environment'],
            stack: target['stack'],
            working_directory: target['working_directory'],
            aws_region: target['aws_region'],
            iam_role_plan: target['iam_role_plan'],
            iam_role_apply: target['iam_role_apply']
          )
        end

        Entities::Result.success(
          pr_number: pr_number,
          target_environment: target_environment,
          kubernetes_targets: target_entities,
          source_branch: target_branch,
          source_sha: ENV['GITHUB_SHA']
        )
      rescue => e
        Entities::Result.failure(error_message: "Failed to extract deployment info: #{e.message}")
      end

      private

      def parse_deployment_targets
        targets_json = ENV['DEPLOYMENT_TARGETS']
        return [] unless targets_json

        JSON.parse(targets_json)
      rescue JSON::ParserError => e
        []
      end
    end
  end
end