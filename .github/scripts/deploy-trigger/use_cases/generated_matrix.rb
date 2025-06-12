# Use case for generating deployment matrix from deploy labels
# Creates deployment targets with all necessary configuration

module UseCases
  module DeployTrigger
    class GenerateMatrix
      def initialize(config_client:)
        @config_client = config_client
      end

      # Execute matrix generation from deploy labels
      def execute(deploy_labels:)
        config = @config_client.load_workflow_config

        deployment_targets = deploy_labels.map do |label|
          generate_deployment_target(label, config)
        end.compact

        Entities::Result.success(
          deployment_targets: deployment_targets,
          has_deployments: deployment_targets.any?,
          total_targets: deployment_targets.length
        )
      rescue => error
        Entities::Result.failure(error_message: error.message)
      end

      private

      # Generate a deployment target from a deploy label and configuration
      def generate_deployment_target(deploy_label, config)
        return nil unless deploy_label.valid?

        Entities::DeploymentTarget.from_deploy_label(deploy_label, config)
      end
    end
  end
end
