# Use case for determining target environment from branch name

module UseCases
  module DeployTrigger
    class DetermineTargetEnvironment
      def initialize(config_client:)
        @config_client = config_client
      end

      # Execute target environment determination
      def execute(branch_name:)
        config = @config_client.load_workflow_config

        target_environment = determine_environment_from_branch(branch_name, config)
        deployment_pattern = determine_deployment_pattern(branch_name)

        if target_environment.nil?
          return Entities::Result.failure(
            error_message: "No target environment determined for branch '#{branch_name}'"
          )
        end

        # Validate environment exists in configuration
        unless config.environments.key?(target_environment)
          return Entities::Result.failure(
            error_message: "Target environment '#{target_environment}' not found in configuration"
          )
        end

        Entities::Result.success(
          target_environment: target_environment,
          branch_name: branch_name,
          deployment_pattern: deployment_pattern,
          environment_config: config.environment_config(target_environment)
        )
      rescue => error
        Entities::Result.failure(error_message: "Failed to determine target environment: #{error.message}")
      end

      private

      def determine_environment_from_branch(branch_name, config)
        # Check configured branch patterns first
        branch_patterns = config.raw_config['branch_patterns'] || {}

        branch_patterns.each do |pattern_name, pattern_config|
          if pattern_config.is_a?(Hash) && pattern_config['pattern']
            if branch_matches_pattern?(branch_name, pattern_config['pattern'])
              return pattern_config['target_environment']
            end
          elsif pattern_name == branch_name
            return pattern_config['target_environment'] if pattern_config.is_a?(Hash)
            return pattern_config if pattern_config.is_a?(String)
          end
        end

        case branch_name
        when /^production\/(.+)/
          'production'
        when /^staging\/(.+)/
          'staging'
        else
          'develop'
        end
      end

      # Check if branch name matches a pattern
      def branch_matches_pattern?(branch_name, pattern)
        if pattern.is_a?(String)
          if pattern.include?('*')
            # Convert shell-style pattern to regex
            regex_pattern = pattern.gsub('*', '.*')
            branch_name =~ /^#{regex_pattern}$/
          else
            branch_name == pattern
          end
        elsif pattern.is_a?(Regexp)
          branch_name =~ pattern
        else
          false
        end
      end

      # Determine deployment pattern type for logging/monitoring
      def determine_deployment_pattern(branch_name)
        case branch_name
        when /^production\/(.+)/
          'single_service_production'
        when /^staging\/(.+)/
          'single_service_staging'
        else
          'all_services_develop'
        end
      end
    end
  end
end
