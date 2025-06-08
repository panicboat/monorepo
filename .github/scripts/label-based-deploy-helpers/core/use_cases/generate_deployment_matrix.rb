class GenerateDeploymentMatrix
  def initialize(config_gateway:)
    @config_gateway = config_gateway
  end

  def execute(deploy_labels:)
    config = @config_gateway.load_workflow_config

    matrix_items = deploy_labels.map do |label|
      generate_matrix_item(label, config)
    end.compact

    Result.success(
      matrix_items: matrix_items,
      has_deployments: matrix_items.any?
    )
  rescue => error
    Result.failure(error_message: error.message)
  end

  private

  def generate_matrix_item(deploy_label, config)
    return nil unless deploy_label.valid?

    env_config = config.environment_config(deploy_label.environment)
    working_dir = config.directory_convention_for(deploy_label.service, deploy_label.stack)
      &.gsub('{service}', deploy_label.service)
      &.gsub('{environment}', deploy_label.environment)

    return nil unless working_dir

    {
      service: deploy_label.service,
      environment: deploy_label.environment,
      stack: deploy_label.stack,
      iam_role_plan: env_config['iam_role_plan'],
      iam_role_apply: env_config['iam_role_apply'],
      aws_region: env_config['aws_region'],
      working_directory: working_dir,
      terraform_version: config.terraform_version,
      terragrunt_version: config.terragrunt_version
    }
  end
end
