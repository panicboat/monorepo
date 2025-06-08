require_relative '../entities/deploy_label'

class DetectChangedServices
  def initialize(file_gateway:, config_gateway:)
    @file_gateway = file_gateway
    @config_gateway = config_gateway
  end

  def execute(base_ref: nil, head_ref: nil)
    config = @config_gateway.load_workflow_config
    changed_files = @file_gateway.get_changed_files(base_ref: base_ref, head_ref: head_ref)

    deploy_labels = detect_deploy_labels(changed_files, config)

    Result.success(
      deploy_labels: deploy_labels,
      changed_files: changed_files,
      services_detected: deploy_labels.map(&:service).uniq
    )
  rescue => error
    Result.failure(error_message: error.message)
  end

  private

  def detect_deploy_labels(changed_files, config)
    labels = []
    discovered_services = discover_services

    discovered_services.each do |service_name|
      config.environments.each do |env_name, env_config|
        %w[terragrunt kubernetes].each do |stack|
          pattern = config.directory_convention_for(service_name, stack)
          next unless pattern

          path = pattern.gsub('{service}', service_name).gsub('{environment}', env_name)

          if files_changed_in_path?(changed_files, path)
            labels << DeployLabel.from_components(
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

  def discover_services
    services = []

    Dir.glob('*/terragrunt/envs').each do |path|
      service_name = path.split('/').first
      services << service_name unless service_name.start_with?('.')
    end

    config = @config_gateway.load_workflow_config
    config.services.each do |service_name, _|
      services << service_name unless services.include?(service_name)
    end

    services.uniq
  end

  def files_changed_in_path?(changed_files, path_pattern)
    changed_files.any? { |file| file.start_with?(path_pattern) }
  end
end
