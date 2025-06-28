# Controller for GitOps Toolkit helper operations
# Orchestrates manifest updates and pull request creation workflow

module Interfaces
  module Controllers
    class GotkHelperController
      def initialize(update_manifests_from_pr_use_case:, presenter:)
        @update_manifests_from_pr_use_case = update_manifests_from_pr_use_case
        @presenter = presenter
      end

      # Execute manifest updates from PR information
      def update_from_pr(
        pr_number:,
        manifest_file:,
        target_repo:,
        target_branch:,
        service_name: nil,
        environment: nil
      )
        if service_name && environment
          puts "Starting manifest update from PR ##{pr_number} for #{service_name}:#{environment}"
        else
          puts "Starting manifest update from PR ##{pr_number}"
        end

        # Execute manifest updates for specified service or all kubernetes targets in PR
        result = @update_manifests_from_pr_use_case.execute(
          pr_number: pr_number,
          manifest_file_path: manifest_file,
          target_repository: target_repo,
          target_branch: target_branch,
          service_name: service_name,
          environment: environment
        )

        unless result.success?
          @presenter.present_error("Manifest update failed: #{result.error_message}")
          return false
        end

        # Present results
        present_pr_results(result, pr_number)
        true
      end

      # Validate manifest workflow for specific service without side effects
      def dry_run_validation(
        pr_number:,
        manifest_file:,
        target_repo:,
        target_branch:,
        service_name:,
        environment:
      )
        puts "🧪 Validating manifest workflow for PR ##{pr_number}"
        puts "Service: #{service_name}"
        puts "Environment: #{environment}"
        puts "Manifest file: #{manifest_file}"
        puts "Target repo: #{target_repo}"
        puts "Target branch: #{target_branch}"

        # Validate manifest file exists and is readable
        unless File.exist?(manifest_file)
          @presenter.present_error("Manifest file not found: #{manifest_file}")
          return false
        end

        unless File.readable?(manifest_file)
          @presenter.present_error("Manifest file not readable: #{manifest_file}")
          return false
        end

        # Validate manifest file content
        begin
          manifest_content = File.read(manifest_file)
          if manifest_content.strip.empty?
            @presenter.present_error("Manifest file is empty: #{manifest_file}")
            return false
          end
          puts "✅ Manifest file validation passed"
        rescue => e
          @presenter.present_error("Failed to read manifest file: #{e.message}")
          return false
        end

        # Extract deployment info for validation
        extract_use_case = @update_manifests_from_pr_use_case.instance_variable_get(:@extract_deployment_info_use_case)
        
        deployment_info = extract_use_case.execute(
          pr_number: pr_number,
          target_branch: target_branch
        )

        unless deployment_info.success?
          @presenter.present_error("Failed to extract PR deployment info: #{deployment_info.error_message}")
          return false
        end

        deploy_labels = deployment_info.data[:deploy_labels].map(&:to_s)
        target_environment = deployment_info.data[:target_environment]
        kubernetes_targets = deployment_info.data[:kubernetes_targets]

        puts "📋 PR deployment information:"
        puts "- Deploy labels: #{deploy_labels.join(', ')}"
        puts "- Target environment: #{target_environment}"
        puts "- Kubernetes targets found: #{kubernetes_targets.length}"

        # Validate service and environment match
        service_label = "deploy:#{service_name}"
        unless deploy_labels.include?(service_label)
          @presenter.present_error("Service label '#{service_label}' not found in PR labels: [#{deploy_labels.join(', ')}]")
          return false
        end

        unless target_environment == environment
          @presenter.present_error("Environment mismatch: expected '#{environment}', got '#{target_environment}'")
          return false
        end

        # Find matching kubernetes target
        matching_target = kubernetes_targets.find do |target|
          target.service == service_name && target.environment == environment
        end

        unless matching_target
          @presenter.present_error("No kubernetes target found for #{service_name}:#{environment}")
          return false
        end

        puts "✅ Service and environment validation passed"
        puts "🎯 Matching kubernetes target found: #{matching_target.service}:#{matching_target.environment}"

        # Simulate what would happen
        feature_branch = "auto-update/#{service_name}-#{environment}-#{deployment_info.data[:source_sha] || 'unknown'}"[0..62]
        target_file = "#{environment}/#{service_name}.yaml"

        puts "📋 Workflow simulation:"
        puts "- Feature branch: #{feature_branch}"
        puts "- Target file: #{target_file}"
        puts "- Manifest source: #{manifest_file}"
        puts "- Target repository: #{target_repo}"
        puts "- Target branch: #{target_branch}"
        puts "- Auto-merge: enabled (squash)"

        puts "✅ Dry run validation completed successfully!"
        puts "Note: All validations passed. Workflow would execute without errors."
        true
      end

      private


      # Present operation results for PR-based updates
      def present_pr_results(result, pr_number)
        processed_count = result.data[:processed_targets]
        has_changes = result.data[:has_changes]

        puts "Processed #{processed_count} kubernetes targets from PR ##{pr_number}"

        if has_changes
          changes_count = result.data[:results].count { |r| r[:has_changes] }
          puts "Successfully created #{changes_count} pull requests"

          # Show details for each result
          result.data[:results].each do |target_result|
            if target_result[:has_changes] && target_result[:pull_request_url]
              puts "#{target_result[:service]}:#{target_result[:environment]} → #{target_result[:pull_request_url]}"
            end
          end
        else
          puts "No changes detected for any targets"
        end
      end
    end
  end
end
