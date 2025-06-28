# Use case for updating multiple manifests based on PR deployment targets
# Orchestrates manifest updates for all kubernetes services found in PR

module UseCases
  module ManifestManagement
    class UpdateManifestsFromPr
      def initialize(
        extract_deployment_info_use_case:,
        update_manifest_use_case:,
        create_pull_request_use_case:
      )
        @extract_deployment_info_use_case = extract_deployment_info_use_case
        @update_manifest_use_case = update_manifest_use_case
        @create_pull_request_use_case = create_pull_request_use_case
      end

      # Execute manifest updates for specific service in PR
      def execute(
        pr_number:,
        manifest_file_path:,
        target_repository:,
        target_branch:,
        service_name: nil,
        environment: nil
      )
        # Extract deployment information from PR
        deployment_info = @extract_deployment_info_use_case.execute(
          pr_number: pr_number,
          target_branch: target_branch
        )
        return deployment_info unless deployment_info.success?

        kubernetes_targets = deployment_info.data[:kubernetes_targets]
        source_repository = ENV['GITHUB_REPOSITORY'] || 'unknown/repository'
        source_sha = ENV['GITHUB_SHA'] || 'unknown'

        # Filter targets if service_name and environment are specified
        if service_name && environment
          kubernetes_targets = kubernetes_targets.select do |target|
            target.service == service_name && target.environment == environment
          end

          if kubernetes_targets.empty?
            return Entities::Result.failure(
              error_message: "No kubernetes target found for #{service_name}:#{environment}"
            )
          end
        end

        results = []
        overall_has_changes = false

        # Process each kubernetes target
        kubernetes_targets.each do |target|
          # Create manifest update request for this target
          request = Entities::ManifestUpdateRequest.from_deployment_target(
            target,
            manifest_file_path: manifest_file_path,
            target_repository: target_repository,
            target_branch: target_branch,
            source_sha: source_sha,
            source_repository: source_repository,
            pr_number: pr_number
          )

          # Update manifest for this service/environment
          update_result = @update_manifest_use_case.execute(request)
          unless update_result.success?
            results << {
              service: target.service,
              environment: target.environment,
              success: false,
              error: update_result.error_message
            }
            next
          end

          has_changes = update_result.data[:has_changes]
          
          # Create pull request if there are changes
          pr_result = @create_pull_request_use_case.execute(request, has_changes: has_changes)
          
          results << {
            service: target.service,
            environment: target.environment,
            success: pr_result.success?,
            has_changes: has_changes,
            pull_request_url: pr_result.pull_request_url,
            error: pr_result.error_message
          }

          overall_has_changes = true if has_changes
        end

        # Check if any updates failed
        failed_updates = results.select { |r| !r[:success] }
        if failed_updates.any?
          error_details = failed_updates.map { |r| "#{r[:service]}:#{r[:environment]} - #{r[:error]}" }
          return Entities::Result.failure(
            error_message: "Some manifest updates failed: #{error_details.join(', ')}"
          )
        end

        Entities::Result.success(
          pr_number: pr_number,
          processed_targets: results.length,
          has_changes: overall_has_changes,
          results: results
        )
      rescue => e
        Entities::Result.failure(error_message: "Failed to update manifests from PR: #{e.message}")
      end
    end
  end
end