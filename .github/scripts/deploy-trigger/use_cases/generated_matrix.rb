# Use case for generating deployment matrix from deploy labels
# Creates deployment targets with all necessary configuration

module UseCases
  module DeployTrigger
    class GenerateMatrix
      def initialize(config_client:)
        @config_client = config_client
      end

      # Execute matrix generation from deploy labels
      def execute(deploy_labels:, target_environment: nil)
        config = @config_client.load_workflow_config

        # If target_environment is not provided, we need to determine it somehow
        # For now, we'll assume it needs to be provided or we'll use 'develop' as default
        target_environment ||= 'develop'

        deployment_targets = []

        deploy_labels.each do |deploy_label|
          next unless deploy_label.valid?

          # Generate targets for each stack (terragrunt, kubernetes, etc.)
          %w[terragrunt kubernetes].each do |stack|
            target = generate_deployment_target(deploy_label, target_environment, stack, config)
            deployment_targets << target if target&.valid?
          end
        end

        Entities::Result.success(
          deployment_targets: deployment_targets,
          has_deployments: deployment_targets.any?,
          total_targets: deployment_targets.length
        )
      rescue => error
        Entities::Result.failure(error_message: error.message)
      end

      private

      # Generate a deployment target from deploy label, environment, and stack
      def generate_deployment_target(deploy_label, target_environment, stack, config)
        env_config = config.environment_config(target_environment)

        # Get directory convention and expand placeholders
        dir_pattern = config.directory_convention_for(deploy_label.service, stack)
        return nil unless dir_pattern

        working_dir = dir_pattern.gsub('{service}', deploy_label.service)

        # Create deployment target
        Entities::DeploymentTarget.new(
          service: deploy_label.service,
          environment: target_environment,
          stack: stack,
          iam_role_plan: env_config['iam_role_plan'],
          iam_role_apply: env_config['iam_role_apply'],
          aws_region: env_config['aws_region'],
          working_directory: working_dir,
          terraform_version: config.terraform_version,
          terragrunt_version: config.terragrunt_version
        )
      end
    end
  end
end
