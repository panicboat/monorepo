require_relative '../interfaces/gateways/config_gateway'
require_relative '../entities/workflow_config'
require 'yaml'

class YamlConfigClient < ConfigGateway
  def initialize(config_path: 'auto-label-mappings.yaml')
    @config_path = config_path
  end

  def load_workflow_config
    unless File.exist?(@config_path)
      raise "Configuration file not found: #{@config_path}"
    end

    config_data = YAML.load_file(@config_path)
    WorkflowConfig.new(config_data)
  rescue => error
    raise "Failed to load configuration from #{@config_path}: #{error.message}"
  end
end
