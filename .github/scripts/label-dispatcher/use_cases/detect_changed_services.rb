# Use case for detecting changed services from file modifications
# Analyzes git diff output to determine which services need deployment

module UseCases
  module LabelManagement
    class DetectChangedServices
      def initialize(file_client:, config_client:)
        @file_client = file_client
        @config_client = config_client
      end

      # Execute service detection based on changed files
      def execute(base_ref: nil, head_ref: nil)
        config = @config_client.load_workflow_config
        changed_files = @file_client.get_changed_files(base_ref: base_ref, head_ref: head_ref)

        deploy_labels = detect_deploy_labels(changed_files, config)

        Entities::Result.success(
          deploy_labels: deploy_labels,
          changed_files: changed_files,
          services_detected: deploy_labels.map(&:service).uniq
        )
      rescue => error
        Entities::Result.failure(error_message: error.message)
      end

      private

      # Detect deploy labels from changed files and configuration
      def detect_deploy_labels(changed_files, config)
        labels = []
        discovered_services = discover_services(changed_files, config)

        discovered_services.each do |service_name|
          config.environments.each do |env_name, env_config|
            %w[terragrunt kubernetes].each do |stack|
              pattern = config.directory_convention_for(service_name, stack)
              next unless pattern

              path = pattern.gsub('{service}', service_name).gsub('{environment}', env_name)

              if files_changed_in_path?(changed_files, path)
                labels << Entities::DeployLabel.from_components(
                  service: service_name,
                  environment: env_name,
                  stack: stack
                )
              end
            end
          end
        end

        labels.uniq
      end

      # Discover services from changed files and configuration
      def discover_services(changed_files, config)
        services = Set.new

        # Add explicitly configured services
        config.services.each do |service_name, _|
          services << service_name
        end

        # Discover services from directory patterns
        default_pattern = config.directory_conventions['terragrunt']
        if default_pattern && default_pattern.include?('{service}')
          services.merge(discover_services_from_pattern(changed_files, default_pattern))
        end

        # Discover services from existing directory structure
        services.merge(discover_services_from_filesystem(config))

        services.to_a.reject { |service| service.start_with?('.') }
      end

      # Discover services by matching changed files against directory pattern
      def discover_services_from_pattern(changed_files, pattern)
        regex_pattern = pattern
          .gsub('{service}', '([^/]+)')
          .gsub('{environment}', '[^/]+')

        services = Set.new
        changed_files.each do |file|
          if match = file.match(/\A#{regex_pattern}/)
            service_name = match[1]
            services << service_name unless service_name.start_with?('.')
          end
        end

        services
      end

      # Discover services from existing filesystem structure
      def discover_services_from_filesystem(config)
        services = Set.new

        # Look for standard terragrunt structure
        terragrunt_dirs = @file_client.find_directories('*/terragrunt/envs/*')
        terragrunt_dirs.each do |path|
          service_name = path.split('/').first
          services << service_name unless service_name.start_with?('.')
        end

        # Look for configured service structures
        config.services.each do |service_name, service_config|
          if service_config['directory_conventions']
            %w[terragrunt kubernetes].each do |stack|
              pattern = service_config['directory_conventions'][stack]
              next unless pattern

              config.environments.each do |env_name, _|
                working_dir = pattern
                  .gsub('{service}', service_name)
                  .gsub('{environment}', env_name)

                if @file_client.directory_exists?(working_dir)
                  services << service_name
                end
              end
            end
          end
        end

        services
      end

      # Check if any files changed in the specified path
      def files_changed_in_path?(changed_files, path_pattern)
        changed_files.any? { |file| file.start_with?(path_pattern) }
      end
    end
  end
end
