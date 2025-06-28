# Console presenter for displaying results in terminal output
# Provides formatted output for development and testing

module Interfaces
  module Presenters
    class ConsolePresenter
      # Present label dispatch results
      def present_label_dispatch_result(deploy_labels:, labels_added:, labels_removed:, changed_files:, excluded_services: [])
        puts "🏷️  Label Dispatch Results".colorize(:blue)
        puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
        puts "Labels Added: #{labels_added.join(', ')}" if labels_added.any?
        puts "Labels Removed: #{labels_removed.join(', ')}" if labels_removed.any?

        if excluded_services.any?
          puts "Excluded Services: #{excluded_services.join(', ')}".colorize(:yellow)
        end

        puts "Changed Files: #{changed_files.length} files"

        if changed_files.length <= 10
          changed_files.each { |file| puts "  - #{file}" }
        else
          puts "  (showing first 10 files)"
          changed_files.first(10).each { |file| puts "  - #{file}" }
          puts "  ... and #{changed_files.length - 10} more files"
        end
      end

      # Present deployment matrix results
      def present_deployment_matrix(
        deployment_targets:,
        deploy_labels:,
        branch_name: nil,
        target_environment: nil,
        merged_pr_number: nil,
        pr_number: nil,
        safety_status: nil
      )
        puts "🚀 Deployment Matrix".colorize(:green)

        # Show context information
        puts "Target Environment: #{target_environment}" if target_environment
        puts "Branch: #{branch_name}" if branch_name
        puts "PR Number: ##{merged_pr_number || pr_number}" if merged_pr_number || pr_number
        puts "Safety Status: #{safety_status}" if safety_status
        puts ""

        puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
        puts "Deployment Targets: #{deployment_targets.length}"

        deployment_targets.each do |target|
          puts "  #{target.service}:#{target.environment}:#{target.stack} -> #{target.working_directory}"
          puts "    IAM Plan Role: #{target.iam_role_plan}" if target.iam_role_plan
          puts "    IAM Apply Role: #{target.iam_role_apply}" if target.iam_role_apply
          puts "    AWS Region: #{target.aws_region}"
          puts ""
        end
      end

      # Present branch deployment results
      def present_branch_deployment_result(deploy_labels:, branch_name:)
        puts "🌿 Branch Deployment Detection".colorize(:blue)
        puts "Branch: #{branch_name}"
        puts "Deploy Labels: #{deploy_labels.map(&:to_s).join(', ')}"
      end

      # Present configuration validation results
      def present_config_validation_result(valid:, errors: [], config: nil, summary: nil)
        if valid
          puts "✅ Configuration is valid".colorize(:green)
          if summary
            puts "Summary:"
            summary.each { |key, value| puts "  #{key}: #{value}" }
          end
        else
          puts "❌ Configuration validation failed".colorize(:red)
          errors.each { |error| puts "  - #{error}" }
        end
      end

      # Present configuration details
      def present_config_details(config:)
        puts "📋 Workflow Configuration".colorize(:blue)
        puts "Environments: #{config.environments.keys.join(', ')}"
        puts "Services: #{config.services.keys.join(', ')}"

        puts "\nDirectory Conventions:"
        config.directory_conventions.each { |stack, pattern| puts "  #{stack}: #{pattern}" }
      end

      # Present service test results
      def present_service_test_result(service_name:, environment:, env_config:, service_config:, terragrunt_directory:, kubernetes_directory:)
        puts "🔧 Service Configuration Test".colorize(:blue)
        puts "Service: #{service_name}"
        puts "Environment: #{environment}"
        puts "Terragrunt Directory: #{terragrunt_directory}"
        puts "Kubernetes Directory: #{kubernetes_directory}"
        puts "IAM Plan Role: #{env_config['iam_role_plan']}"
        puts "IAM Apply Role: #{env_config['iam_role_apply']}"
        puts "AWS Region: #{env_config['aws_region']}"
      end

      # Present diagnostic results
      def present_diagnostic_results(results:)
        puts "🏥 Diagnostic Results".colorize(:blue)
        results.each do |result|
          status_color = case result[:status]
                        when 'PASS' then :green
                        when 'WARN' then :yellow
                        when 'FAIL' then :red
                        else :white
                        end

          puts "#{result[:status].ljust(4)} #{result[:check]}: #{result[:details]}".colorize(status_color)
        end
      end

      # Present config template
      def present_config_template(template:)
        puts "📋 Configuration Template".colorize(:blue)
        puts ""
        puts template
      end

      # Present error results
      def present_error(result)
        puts "❌ Error: #{result.error_message}".colorize(:red)
        exit 1
      end

      # Present service discovery results
      def present_service_discovery_result(discovered_services:, method:)
        puts "🔍 Service Discovery Results".colorize(:yellow)
        puts "Discovery Method: #{method}"
        puts "Discovered Services: #{discovered_services.join(', ')}"
      end

      # Present manifest update start message
      def present_manifest_update_start(pr_number:, service_name: nil, environment: nil)
        if service_name && environment
          puts "🚀 Starting manifest update from PR ##{pr_number} for #{service_name}:#{environment}".colorize(:blue)
        else
          puts "🚀 Starting manifest update from PR ##{pr_number}".colorize(:blue)
        end
      end

      # Present dry run validation start
      def present_dry_run_start(pr_number:, service_name:, environment:, manifest_file:, target_repo:, target_branch:)
        puts "🧪 Validating manifest workflow for PR ##{pr_number}".colorize(:yellow)
        puts "Service: #{service_name}"
        puts "Environment: #{environment}"
        puts "Manifest file: #{manifest_file}"
        puts "Target repo: #{target_repo}"
        puts "Target branch: #{target_branch}"
      end

      # Present manifest validation results
      def present_manifest_validation_result(file_path:, valid:, error_message: nil)
        if valid
          puts "✅ Manifest file validation passed".colorize(:green)
        else
          puts "❌ Manifest file validation failed: #{error_message}".colorize(:red)
        end
      end

      # Present deployment information from PR
      def present_pr_deployment_info(deploy_labels:, target_environment:, kubernetes_targets_count:)
        puts "📋 PR deployment information:".colorize(:blue)
        puts "- Deploy labels: #{deploy_labels.join(', ')}"
        puts "- Target environment: #{target_environment}"
        puts "- Kubernetes targets found: #{kubernetes_targets_count}"
      end

      # Present service validation results
      def present_service_validation_result(service_name:, environment:, deploy_labels:, target_environment:, valid:)
        if valid
          puts "✅ Service and environment validation passed".colorize(:green)
        else
          service_label = "deploy:#{service_name}"
          if !deploy_labels.include?(service_label)
            puts "❌ Service label '#{service_label}' not found in PR labels: [#{deploy_labels.join(', ')}]".colorize(:red)
          elsif target_environment != environment
            puts "❌ Environment mismatch: expected '#{environment}', got '#{target_environment}'".colorize(:red)
          end
        end
      end

      # Present kubernetes target match
      def present_target_match(service_name:, environment:)
        puts "🎯 Matching kubernetes target found: #{service_name}:#{environment}".colorize(:green)
      end

      # Present workflow simulation
      def present_workflow_simulation(feature_branch:, target_file:, manifest_file:, target_repo:, target_branch:)
        puts "📋 Workflow simulation:".colorize(:blue)
        puts "- Feature branch: #{feature_branch}"
        puts "- Target file: #{target_file}"
        puts "- Manifest source: #{manifest_file}"
        puts "- Target repository: #{target_repo}"
        puts "- Target branch: #{target_branch}"
        puts "- Auto-merge: enabled (squash)"
      end

      # Present dry run completion
      def present_dry_run_completion
        puts "✅ Dry run validation completed successfully!".colorize(:green)
        puts "Note: All validations passed. Workflow would execute without errors."
      end

      # Present manifest update results
      def present_manifest_update_results(result:, pr_number:)
        processed_count = result.data[:processed_targets]
        has_changes = result.data[:has_changes]

        puts "📊 Processed #{processed_count} kubernetes targets from PR ##{pr_number}".colorize(:blue)

        if has_changes
          changes_count = result.data[:results].count { |r| r[:has_changes] }
          puts "✅ Successfully created #{changes_count} pull requests".colorize(:green)

          result.data[:results].each do |target_result|
            if target_result[:has_changes] && target_result[:pull_request_url]
              puts "#{target_result[:service]}:#{target_result[:environment]} → #{target_result[:pull_request_url]}"
            end
          end
        else
          puts "ℹ️  No changes detected for any targets".colorize(:yellow)
        end
      end
    end
  end
end
