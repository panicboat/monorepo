# Use case for detecting changed services from file modifications
# Analyzes git diff output to determine which services need deployment
# Phase 1: Added service exclusion filtering

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

        # Discover all services from file changes
        all_discovered_services = discover_services(changed_files, config)

        # Filter out excluded services
        filtered_services = filter_excluded_services(all_discovered_services, config, changed_files)
        excluded_services = all_discovered_services - filtered_services

        # Generate deploy labels for non-excluded services
        deploy_labels = filtered_services.map { |service| Entities::DeployLabel.from_service(service: service) }

        # Log excluded services if any
        log_excluded_services(excluded_services, config) if excluded_services.any?

        Entities::Result.success(
          deploy_labels: deploy_labels,
          changed_files: changed_files,
          services_detected: filtered_services,
          excluded_services: excluded_services,
          total_services_discovered: all_discovered_services.length
        )
      rescue => error
        Entities::Result.failure(error_message: error.message)
      end

      private

      # Filter out services that are excluded from automation
      def filter_excluded_services(discovered_services, config, changed_files)
        discovered_services.reject do |service|
          excluded_from_automation?(service, config, changed_files)
        end
      end

      # Check if a service is excluded from automation
      def excluded_from_automation?(service, config, changed_files)
        service_config = config.services[service]
        return false unless service_config

        return true if service_config['exclude_from_automation'] == true

        false
      end

      # Log excluded services for visibility
      def log_excluded_services(excluded_services, config)
        return if excluded_services.empty?

        puts "⚠️  Services excluded from automation (#{excluded_services.length}):"
        excluded_services.each do |service|
          service_config = config.services[service]
          exclusion_config = service_config&.[]('exclusion_config') || {}
          reason = exclusion_config['reason'] || 'No reason specified'
          type = exclusion_config['type'] || 'unspecified'

          puts "  - #{service} (#{type}): #{reason}"
        end
      end

      # Detect deploy labels from changed files and configuration
      def detect_deploy_labels(changed_files, config)
        # This method is now replaced by the main execute method
        # Keeping for backward compatibility if needed
        discovered_services = discover_services(changed_files, config)
        filtered_services = filter_excluded_services(discovered_services, config, changed_files)
        filtered_services.map { |service| Entities::DeployLabel.from_service(service: service) }
      end

      # Discover services from changed files and configuration
      def discover_services(changed_files, config)
        services = Set.new

        # Add explicitly configured services that have changed files
        config.services.each do |service_name, _|
          if files_changed_in_service?(changed_files, service_name)
            services << service_name
          end
        end

        # Discover services from directory patterns
        default_pattern = config.directory_conventions['terragrunt']
        if default_pattern && default_pattern.include?('{service}')
          services.merge(discover_services_from_pattern(changed_files, default_pattern))
        end

        # Discover services from existing directory structure
        if services.empty?
          services.merge(discover_services_from_filesystem(changed_files))
        end

        services.to_a.reject { |service| service.start_with?('.') }
      end

      # Check if any files changed in a service directory
      def files_changed_in_service?(changed_files, service_name)
        changed_files.any? { |file| file.start_with?("#{service_name}/") }
      end

      # Discover services by matching changed files against directory pattern
      def discover_services_from_pattern(changed_files, pattern)
        # Convert pattern like "{service}/terragrunt" to regex
        regex_pattern = pattern.gsub('{service}', '([^/]+)')

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
      def discover_services_from_filesystem(changed_files)
        services = Set.new

        changed_files.each do |file|
          # Extract service name from file path (first directory component)
          path_parts = file.split('/')
          next if path_parts.empty?

          potential_service = path_parts.first
          next if potential_service.start_with?('.')

          # Check if this looks like a service directory
          if looks_like_service_directory?(potential_service)
            services << potential_service
          end
        end

        services
      end

      # Check if a directory name looks like a service directory
      def looks_like_service_directory?(dir_name)
        # Skip common non-service directories
        excluded_dirs = %w[.github docs scripts tests spec bin lib config public assets]
        return false if excluded_dirs.include?(dir_name)

        # Must be a valid service name
        dir_name.match?(/\A[a-zA-Z0-9\-_]+\z/)
      end
    end
  end
end
