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
        @presenter.present_manifest_update_start(
          pr_number: pr_number,
          service_name: service_name,
          environment: environment
        )

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
          @presenter.present_error(result)
          return false
        end

        # Present results
        @presenter.present_manifest_update_results(result: result, pr_number: pr_number)
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
        @presenter.present_dry_run_start(
          pr_number: pr_number,
          service_name: service_name,
          environment: environment,
          manifest_file: manifest_file,
          target_repo: target_repo,
          target_branch: target_branch
        )

        # Validate manifest file exists and is readable
        unless File.exist?(manifest_file)
          @presenter.present_manifest_validation_result(
            file_path: manifest_file,
            valid: false,
            error_message: "Manifest file not found"
          )
          return false
        end

        unless File.readable?(manifest_file)
          @presenter.present_manifest_validation_result(
            file_path: manifest_file,
            valid: false,
            error_message: "Manifest file not readable"
          )
          return false
        end

        # Validate manifest file content
        begin
          manifest_content = File.read(manifest_file)
          if manifest_content.strip.empty?
            @presenter.present_manifest_validation_result(
              file_path: manifest_file,
              valid: false,
              error_message: "Manifest file is empty"
            )
            return false
          end
          @presenter.present_manifest_validation_result(file_path: manifest_file, valid: true)
        rescue => e
          @presenter.present_manifest_validation_result(
            file_path: manifest_file,
            valid: false,
            error_message: "Failed to read manifest file: #{e.message}"
          )
          return false
        end

        # Extract deployment info for validation
        extract_use_case = @update_manifests_from_pr_use_case.instance_variable_get(:@extract_deployment_info_use_case)

        deployment_info = extract_use_case.execute(
          pr_number: pr_number,
          target_branch: target_branch
        )

        unless deployment_info.success?
          @presenter.present_error(deployment_info)
          return false
        end

        target_environment = deployment_info.data[:target_environment]
        kubernetes_targets = deployment_info.data[:kubernetes_targets]
        
        # Generate deploy labels from kubernetes targets
        deploy_labels = kubernetes_targets.map { |target| "deploy:#{target.service}" }.uniq

        @presenter.present_pr_deployment_info(
          deploy_labels: deploy_labels,
          target_environment: target_environment,
          kubernetes_targets_count: kubernetes_targets.length
        )

        # Validate service and environment match
        service_label = "deploy:#{service_name}"
        service_valid = deploy_labels.include?(service_label) && target_environment == environment
        
        @presenter.present_service_validation_result(
          service_name: service_name,
          environment: environment,
          deploy_labels: deploy_labels,
          target_environment: target_environment,
          valid: service_valid
        )
        
        return false unless service_valid

        # Find matching kubernetes target
        matching_target = kubernetes_targets.find do |target|
          target.service == service_name && target.environment == environment
        end

        unless matching_target
          @presenter.present_manifest_validation_result(
            file_path: "#{service_name}:#{environment}",
            valid: false,
            error_message: "No kubernetes target found"
          )
          return false
        end

        @presenter.present_target_match(
          service_name: matching_target.service,
          environment: matching_target.environment
        )

        # Simulate what would happen
        feature_branch = "auto-update/#{service_name}-#{environment}-#{deployment_info.data[:source_sha] || 'unknown'}"[0..62]
        target_file = "#{environment}/#{service_name}.yaml"

        @presenter.present_workflow_simulation(
          feature_branch: feature_branch,
          target_file: target_file,
          manifest_file: manifest_file,
          target_repo: target_repo,
          target_branch: target_branch
        )

        @presenter.present_dry_run_completion
        true
      end

      private


    end
  end
end
