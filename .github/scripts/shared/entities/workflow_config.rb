# Workflow configuration entity representing the parsed YAML configuration
# Provides access to environments, services, and directory conventions

module Entities
  class WorkflowConfig
    attr_reader :raw_config

    def initialize(config_hash)
      @raw_config = config_hash
    end

    # Get environment configuration with defaults merged
    def environment_config(env_name)
      env_config = environments[env_name] || {}
      env_config.merge(defaults) { |key, env_val, default_val| env_val || default_val }
    end

    # Get directory convention for a service and stack
    def directory_convention_for(service_name, stack = 'terragrunt')
      service_config = services[service_name]
      if service_config && service_config['directory_conventions'] && service_config['directory_conventions'][stack]
        service_config['directory_conventions'][stack]
      else
        directory_conventions[stack]
      end
    end

    # Get terraform version from modules configuration
    def terraform_version
      modules['terraform_version'] || '1.12.1'
    end

    # Get terragrunt version from modules configuration
    def terragrunt_version
      modules['terragrunt_version'] || '0.81.0'
    end

    # Get kubectl version from modules configuration
    def kubectl_version
      modules['kubectl_version'] || '1.28.0'
    end

    # Get kustomize version from modules configuration
    def kustomize_version
      modules['kustomize_version'] || '5.0.0'
    end

    # Get all environments as a hash
    def environments
      @environments ||= (raw_config['environments'] || []).each_with_object({}) do |env, hash|
        hash[env['environment']] = env
      end
    end

    # Get default configuration values
    def defaults
      @defaults ||= raw_config['defaults'] || {}
    end

    # Get all services as a hash
    def services
      @services ||= (raw_config['services'] || []).each_with_object({}) do |service, hash|
        hash[service['name']] = service
      end
    end

    # Get directory conventions
    def directory_conventions
      @directory_conventions ||= raw_config['directory_conventions'] || {}
    end

    # Get modules configuration
    def modules
      @modules ||= raw_config['modules'] || {}
    end
  end
end
