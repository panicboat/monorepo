# Use case for filtering deployment labels by target environment
# Implements the core environment matching logic from Issue #107

module UseCases
  module DeployTrigger
    class FilterLabelsByEnvironment
      def initialize(config_client:)
        @config_client = config_client
      end

      # Execute label filtering based on target environment
      def execute(deploy_labels:, target_environment:)
        config = @config_client.load_workflow_config

        # Validate target environment exists in configuration
        unless config.environments.key?(target_environment)
          return Entities::Result.failure(
            error_message: "Unknown target environment: #{target_environment}"
          )
        end

        # Filter labels by environment matching
        filtered_labels = filter_labels_by_environment(deploy_labels, target_environment)

        if filtered_labels.empty?
          return Entities::Result.failure(
            error_message: "No deployment labels match target environment '#{target_environment}'"
          )
        end

        Entities::Result.success(
          filtered_labels: filtered_labels,
          target_environment: target_environment,
          total_labels: deploy_labels.length,
          filtered_count: filtered_labels.length,
          excluded_labels: deploy_labels - filtered_labels
        )
      rescue => error
        Entities::Result.failure(error_message: "Failed to filter labels by environment: #{error.message}")
      end

      private

      # Core environment matching logic from Issue #107 strategy
      def filter_labels_by_environment(deploy_labels, target_environment)
        case target_environment
        when 'develop'
          deploy_labels.select { |label| label.environment == 'develop' }
        when 'staging'
          deploy_labels.select { |label| label.environment == 'staging' }
        when 'production'
          deploy_labels.select { |label| label.environment == 'production' }
        else
          # Support for custom environments
          deploy_labels.select { |label| label.environment == target_environment }
        end
      end
    end
  end
end
