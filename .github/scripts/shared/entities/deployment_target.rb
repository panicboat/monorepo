# Deployment target entity representing a specific deployment configuration
# Contains all necessary information for a deployment matrix item

module Entities
  class DeploymentTarget
    attr_reader :service, :environment, :stack, :iam_role_plan, :iam_role_apply,
                :aws_region, :working_directory, :terraform_version, :terragrunt_version

    def initialize(
      service:,
      environment:,
      stack: 'terragrunt',
      iam_role_plan:,
      iam_role_apply:,
      aws_region:,
      working_directory:,
      terraform_version: '1.12.1',
      terragrunt_version: '0.81.0'
    )
      @service = service
      @environment = environment
      @stack = stack
      @iam_role_plan = iam_role_plan
      @iam_role_apply = iam_role_apply
      @aws_region = aws_region
      @working_directory = working_directory
      @terraform_version = terraform_version
      @terragrunt_version = terragrunt_version
    end

    # Convert to hash for GitHub Actions matrix
    def to_matrix_item
      {
        service: service,
        environment: environment,
        stack: stack,
        iam_role_plan: iam_role_plan,
        iam_role_apply: iam_role_apply,
        aws_region: aws_region,
        working_directory: working_directory,
        terraform_version: terraform_version,
        terragrunt_version: terragrunt_version
      }
    end

    # Create from deploy label, target environment, and configuration
    def self.from_deploy_label_and_environment(deploy_label, target_environment, config, stack: 'terragrunt')
      return nil unless deploy_label.valid?

      env_config = config.environment_config(target_environment)

      # Get directory convention and expand placeholders
      dir_pattern = config.directory_convention_for(deploy_label.service, stack)
      working_dir = expand_directory_pattern(dir_pattern, deploy_label.service, target_environment)

      return nil unless working_dir

      new(
        service: deploy_label.service,
        environment: target_environment,
        stack: stack,
        iam_role_plan: env_config['iam_role_plan'],
        iam_role_apply: env_config['iam_role_apply'],
        aws_region: env_config['aws_region'],
        working_directory: working_dir,
        terraform_version: config.terraform_version,
        terragrunt_version: config.terragrunt_version
      )
    end

    # Check if deployment target is valid
    def valid?
      service && environment && working_directory && iam_role_plan && iam_role_apply
    end

    # Equality comparison
    def ==(other)
      return false unless other.is_a?(DeploymentTarget)
      service == other.service &&
      environment == other.environment &&
      stack == other.stack &&
      working_directory == other.working_directory
    end

    # Hash for use in collections
    def hash
      [service, environment, stack, working_directory].hash
    end

    # Enable use in sets and as hash keys
    alias eql? ==
  end
end
