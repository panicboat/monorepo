# Deployment target entity representing a specific deployment configuration
# Contains all necessary information for a deployment matrix item
# Phase 1: Enhanced with stack-specific configurations

module Entities
  class DeploymentTarget
    attr_reader :service, :environment, :stack, :iam_role_plan, :iam_role_apply,
                :aws_region, :working_directory, :terraform_version, :terragrunt_version,
                :kubectl_version, :kustomize_version

    def initialize(
      service:,
      environment:,
      stack: 'terragrunt',
      iam_role_plan: nil,
      iam_role_apply: nil,
      aws_region:,
      working_directory:,
      terraform_version: nil,
      terragrunt_version: nil,
      kubectl_version: nil,
      kustomize_version: nil
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
      @kubectl_version = kubectl_version
      @kustomize_version = kustomize_version
    end

    # Convert to hash for GitHub Actions matrix
    def to_matrix_item
      base_item = {
        service: service,
        environment: environment,
        stack: stack,
        aws_region: aws_region,
        working_directory: working_directory
      }

      # Add stack-specific configurations
      case stack
      when 'terragrunt'
        base_item.merge({
          iam_role_plan: iam_role_plan,
          iam_role_apply: iam_role_apply,
          terraform_version: terraform_version || '1.12.1',
          terragrunt_version: terragrunt_version || '0.81.0'
        })
      when 'kubernetes'
        base_item.merge({
          kubectl_version: kubectl_version || '1.28.0',
          kustomize_version: kustomize_version || '5.0.0'
        })
      else
        # Generic stack - include all available configurations
        item = base_item.dup
        item[:iam_role_plan] = iam_role_plan if iam_role_plan
        item[:iam_role_apply] = iam_role_apply if iam_role_apply
        item[:terraform_version] = terraform_version if terraform_version
        item[:terragrunt_version] = terragrunt_version if terragrunt_version
        item[:kubectl_version] = kubectl_version if kubectl_version
        item[:kustomize_version] = kustomize_version if kustomize_version
        item
      end
    end

    # Create from deploy label, target environment, and configuration
    def self.from_deploy_label_and_environment(deploy_label, target_environment, config, stack: 'terragrunt')
      return nil unless deploy_label.valid?

      env_config = config.environment_config(target_environment)

      # Get directory convention and expand placeholders
      dir_pattern = config.directory_convention_for(deploy_label.service, stack)
      return nil unless dir_pattern

      working_dir = expand_directory_pattern(dir_pattern, deploy_label.service, target_environment)
      return nil unless working_dir

      case stack
      when 'terragrunt'
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
      when 'kubernetes'
        new(
          service: deploy_label.service,
          environment: target_environment,
          stack: stack,
          aws_region: env_config['aws_region'],
          working_directory: working_dir,
          kubectl_version: config.kubectl_version,
          kustomize_version: config.kustomize_version
        )
      else
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
    end

    # Check if deployment target is valid
    def valid?
      return false unless service && environment && working_directory && aws_region

      case stack
      when 'terragrunt'
        # Terragrunt targets need IAM roles
        iam_role_plan && iam_role_apply
      when 'kubernetes'
        # Kubernetes targets don't need IAM roles but need kubectl/kustomize versions
        true  # Basic validation passed
      else
        # Generic validation - at minimum need basic fields
        true
      end
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

    private

    # Expand directory pattern with placeholders
    def self.expand_directory_pattern(pattern, service_name, target_environment)
      return nil unless pattern

      pattern
        .gsub('{service}', service_name)
        .gsub('{environment}', target_environment)
    end
  end
end
