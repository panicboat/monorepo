class DetermineBranchDeployments
  def initialize(file_gateway:, config_gateway:)
    @file_gateway = file_gateway
    @config_gateway = config_gateway
  end

  def execute(branch_name:)
    config = @config_gateway.load_workflow_config

    deploy_labels = case branch_name
    when 'develop'
      generate_develop_labels(config)
    when /^staging\/(.+)/
      service_name = Regexp.last_match(1)
      [DeployLabel.from_components(service: service_name, environment: 'staging')]
    when /^production\/(.+)/
      service_name = Regexp.last_match(1)
      [DeployLabel.from_components(service: service_name, environment: 'production')]
    else
      []
    end

    Result.success(deploy_labels: deploy_labels.compact)
  rescue => error
    Result.failure(error_message: error.message)
  end

  private

  def generate_develop_labels(config)
    services = discover_services(config)

    services.map do |service_name|
      working_dir = config.directory_convention_for(service_name, 'terragrunt')
        &.gsub('{service}', service_name)
        &.gsub('{environment}', 'develop')

      if working_dir && @file_gateway.directory_exists?(working_dir)
        DeployLabel.from_components(service: service_name, environment: 'develop')
      end
    end.compact
  end

  def discover_services(config)
    services = []

    Dir.glob('*/terragrunt/envs/develop').each do |path|
      service_name = path.split('/').first
      services << service_name unless service_name.start_with?('.')
    end

    config.services.each do |service_name, service_config|
      working_dir = service_config['directory_conventions'] ?
        service_config['directory_conventions']['terragrunt']&.gsub('{service}', service_name)&.gsub('{environment}', 'develop') :
        nil
      if working_dir && @file_gateway.directory_exists?(working_dir)
        services << service_name
      end
    end

    services.uniq
  end
end
