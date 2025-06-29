# Controller for GitOps Toolkit helper operations
# Orchestrates GitOps request creation and pull request workflow

module Interfaces
  module Controllers
    class GotkHelperController
      def initialize(create_gitops_request_use_case:, presenter:)
        @create_gitops_request_use_case = create_gitops_request_use_case
        @presenter = presenter
      end

      # Execute GitOps request creation from PR information
      def create_gitops_request(
        pr_number:,
        manifest_file:,
        target_repo:,
        target_branch:,
        service_name: nil,
        environment: nil
      )
        puts "🚀 Starting GitOps request creation for PR ##{pr_number}"
        puts "Service: #{service_name}" if service_name
        puts "Environment: #{environment}" if environment

        # Execute GitOps request creation for specified service or all kubernetes targets in PR
        result = @create_gitops_request_use_case.execute(
          pr_number: pr_number,
          manifest_file_path: manifest_file,
          target_repository: target_repo,
          target_branch: target_branch,
          service_name: service_name,
          environment: environment
        )

        unless result.success?
          puts "❌ Error: #{result.error_message}"
          return false
        end

        # Present results
        puts "✅ GitOps request creation completed successfully for PR ##{pr_number}"
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
        puts "🔍 Starting dry run validation for PR ##{pr_number}"
        puts "Service: #{service_name}"
        puts "Environment: #{environment}"
        puts "Manifest File: #{manifest_file}"
        puts "Target Repository: #{target_repo}"
        puts "Target Branch: #{target_branch}"

        # Validate manifest file exists and is readable
        unless File.exist?(manifest_file)
          puts "❌ Manifest file not found: #{manifest_file}"
          return false
        end

        unless File.readable?(manifest_file)
          puts "❌ Manifest file not readable: #{manifest_file}"
          return false
        end

        # Validate manifest file content
        begin
          manifest_content = File.read(manifest_file)
          if manifest_content.strip.empty?
            puts "❌ Manifest file is empty: #{manifest_file}"
            return false
          end
          puts "✅ Manifest file validation passed: #{manifest_file}"
        rescue => e
          puts "❌ Failed to read manifest file: #{manifest_file} - #{e.message}"
          return false
        end

        # Validate required parameters
        unless service_name && environment
          puts "❌ Error: service_name and environment are required"
          return false
        end

        deploy_label = "deploy:#{service_name}"

        puts "📋 PR Deployment Information:"
        puts "Deploy Label: #{deploy_label}"
        puts "Target Environment: #{environment}"
        puts "Service: #{service_name}"

        puts "✅ Parameter validation passed"
        puts "  Service: #{service_name}"
        puts "  Environment: #{environment}"

        # Simulate what would happen
        source_sha = ENV['GITHUB_SHA']
        feature_branch = "auto-update/#{service_name}-#{environment}-#{source_sha}"[0..62]
        target_file = "#{environment}/#{service_name}.yaml"

        puts "🎭 Workflow Simulation:"
        puts "  Feature Branch: #{feature_branch}"
        puts "  Target File: #{target_file}"
        puts "  Manifest File: #{manifest_file}"
        puts "  Target Repository: #{target_repo}"
        puts "  Target Branch: #{target_branch}"

        puts "✅ Dry run validation completed successfully"
        true
      end

      private


    end
  end
end
