# GitHub Actions presenter for formatting output for GitHub Actions workflows
# Handles environment variable setting and action outputs

module Interfaces
  module Presenters
    class GitHubActionsPresenter
      # Present label dispatch results for GitHub Actions
      def present_label_dispatch_result(deploy_labels:, labels_added:, labels_removed:, changed_files:)
        set_environment_variables(
          'DEPLOY_LABELS' => deploy_labels.map(&:to_s).to_json,
          'LABELS_ADDED' => labels_added.to_json,
          'LABELS_REMOVED' => labels_removed.to_json,
          'HAS_CHANGES' => deploy_labels.any?.to_s,
          'CHANGED_FILES' => changed_files.to_json,
          'SERVICES_DETECTED' => deploy_labels.map(&:service).uniq.to_json
        )

        set_action_outputs(
          'deploy_labels' => deploy_labels.map(&:to_s).to_json,
          'has_changes' => deploy_labels.any?.to_s
        )

        puts "🏷️ Label Dispatch Completed"
        puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
        puts "Labels Added: #{labels_added.join(', ')}" if labels_added.any?
        puts "Labels Removed: #{labels_removed.join(', ')}" if labels_removed.any?
      end

      # Present deployment matrix for GitHub Actions
      def present_deployment_matrix(
        deployment_targets:,
        deploy_labels:,
        branch_name: nil,
        target_environment: nil,
        merged_pr_number: nil,
        pr_number: nil,
        safety_status: nil
      )
        matrix_items = deployment_targets.map(&:to_matrix_item)

        set_environment_variables(
          'DEPLOYMENT_TARGETS' => matrix_items.to_json,
          'HAS_TARGETS' => deployment_targets.any?.to_s,
          'DEPLOY_LABELS' => deploy_labels.map(&:to_s).to_json,
          'TARGET_ENVIRONMENT' => target_environment,
          'BRANCH_NAME' => branch_name,
          'MERGED_PR_NUMBER' => merged_pr_number || pr_number,
          'SAFETY_STATUS' => safety_status
        )

        set_action_outputs(
          'targets' => matrix_items.to_json,
          'has_targets' => deployment_targets.any?.to_s,
          'target_environment' => target_environment
        )

        puts "🚀 Deployment Matrix Generated"
        puts "Targets: #{deployment_targets.length} deployment(s)"
        puts "Target Environment: #{target_environment}" if target_environment
        puts "Branch: #{branch_name}" if branch_name
        puts "PR: ##{merged_pr_number || pr_number}" if merged_pr_number || pr_number

        deployment_targets.each do |target|
          puts "  #{target.service}:#{target.environment}:#{target.stack} -> #{target.working_directory}"
        end
      end

      # Present branch deployment results for GitHub Actions
      def present_branch_deployment_result(deploy_labels:, branch_name:)
        deployment_targets = deploy_labels.map { |label| create_simple_target_from_label(label) }
        matrix_items = deployment_targets.map(&:to_matrix_item)

        set_environment_variables(
          'DEPLOYMENT_TARGETS' => matrix_items.to_json,
          'HAS_TARGETS' => deploy_labels.any?.to_s,
          'DEPLOY_LABELS' => deploy_labels.map(&:to_s).to_json,
          'BRANCH_NAME' => branch_name
        )

        puts "🌿 Branch Deployment Detection"
        puts "Branch: #{branch_name}"
        puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
      end

      # Present configuration validation results for GitHub Actions
      def present_config_validation_result(valid:, errors: [])
        set_environment_variables(
          'CONFIG_VALID' => valid.to_s,
          'CONFIG_ERRORS' => errors.to_json
        )

        set_action_outputs(
          'config_valid' => valid.to_s
        )

        if valid
          puts "✅ Configuration is valid"
        else
          puts "❌ Configuration validation failed"
          errors.each { |error| puts "  - #{error}" }
        end
      end

      # Present error results for GitHub Actions
      def present_error(result)
        set_environment_variables(
          'ERROR_OCCURRED' => 'true',
          'ERROR_MESSAGE' => result.error_message
        )

        puts "::error::#{result.error_message}"
        exit 1
      end

      private

      # Set GitHub Actions environment variables
      def set_environment_variables(variables)
        return unless ENV['GITHUB_ENV']

        File.open(ENV['GITHUB_ENV'], 'a') do |f|
          variables.each { |key, value| f.puts "#{key}=#{value}" }
        end
      end

      # Set GitHub Actions step outputs
      def set_action_outputs(outputs)
        outputs.each do |key, value|
          puts "::set-output name=#{key}::#{value}"
        end
      end

      # Create a simple deployment target from a deploy label
      def create_simple_target_from_label(deploy_label)
        Entities::DeploymentTarget.new(
          service: deploy_label.service,
          environment: deploy_label.environment,
          stack: deploy_label.stack,
          working_directory: "#{deploy_label.service}/terragrunt/envs/#{deploy_label.environment}",
          iam_role_plan: "arn:aws:iam::559744160976:role/github-oidc-auth-develop-github-actions-role",
          iam_role_apply: "arn:aws:iam::559744160976:role/github-oidc-auth-develop-github-actions-role",
          aws_region: "ap-northeast-1",
          terraform_version: "1.12.1",
          terragrunt_version: "0.81.0"
        )
      end
    end
  end
end
