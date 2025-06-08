class WorkflowConfig
  attr_reader :raw_config

  def initialize(config_hash)
    @raw_config = config_hash
  end

  def environment_config(env_name)
    env_config = environments[env_name] || {}
    env_config.merge(defaults) { |key, env_val, default_val| env_val || default_val }
  end

  def directory_convention_for(service_name, stack = 'terragrunt')
    service_config = services[service_name]
    if service_config && service_config['directory_conventions'] && service_config['directory_conventions'][stack]
      service_config['directory_conventions'][stack]
    else
      directory_conventions[stack]
    end
  end

  def terraform_version
    modules['terraform_version'] || '1.12.1'
  end

  def terragrunt_version
    modules['terragrunt_version'] || '0.81.0'
  end

  # PUBLIC methods (removed private keyword)
  def environments
    @environments ||= (raw_config['environments'] || []).each_with_object({}) do |env, hash|
      hash[env['environment']] = env
    end
  end

  def defaults
    @defaults ||= raw_config['defaults'] || {}
  end

  def services
    @services ||= (raw_config['services'] || []).each_with_object({}) do |service, hash|
      hash[service['name']] = service
    end
  end

  def directory_conventions
    @directory_conventions ||= raw_config['directory_conventions'] || {}
  end

  def modules
    @modules ||= raw_config['modules'] || {}
  end
end
