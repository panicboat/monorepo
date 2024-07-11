require_relative 'workflow_base'

class Base::WorkflowTemplate < Base::WorkflowBase
  def create(is_create_config_map, is_create_service_account)
    data = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'WorkflowTemplate',
      metadata: {
        name: name,
        labels: {
          'workflows.argoproj.io/owner' => owner,
          'workflows.argoproj.io/service' => service,
        },
        annotations: {
          'workflows.argoproj.io/title' => name,
          'workflows.argoproj.io/description' => '',
        },
      },
      spec: {
        entrypoint: 'main',
        arguments: {
          parameters: [
            { name: 'message', value: 'Hello, World!' }
          ],
        },
        workflowMetadata: {
          labels: {
            'workflows.argoproj.io/name' => name,
            'workflows.argoproj.io/owner' => owner,
            'workflows.argoproj.io/service' => service,
          },
        },
        activeDeadlineSeconds: 28800,
        templates:[{
          name: 'main',
          # metadata: {
          #   labels: {
          #     'admission.datadoghq.com/enabled' => 'true',
          #     'admission.datadoghq.com/config.mode' => 'socket',
          #     'tags.datadoghq.com/service' => service,
          #     'tags.datadoghq.com/env' => '${NAMESPACE}',
          #   }
          # },
          container: {
            name: 'main',
            image: 'docker/whalesay',
            command: ['cowsay'],
            args: ['{{workflow.parameters.message}}'],
            resources: {
              limits: { memory: '32Mi' },
              requests: { cpu: '100m', memory: '32Mi' },
            },
          },
        }],
      },
    }
    data[:spec][:templates][0][:container][:envFrom] = [{ configMapRef: { name: name } }] if is_create_config_map
    data[:spec][:serviceAccountName] = name if is_create_service_account
    data
  end
end
