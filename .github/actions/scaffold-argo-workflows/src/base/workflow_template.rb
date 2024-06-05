require_relative 'workflow_base'

class Base::WorkflowTemplate < Base::WorkflowBase
  def create(is_create_service_account)
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
          container: {
            name: 'main',
            image: 'docker/whalesay',
            command: ['cowsay'],
            args: ['{{workflow.parameters.message}}'],
            resources: {
              limits: { memory: '32Mi' },
              requests: { cpu: '100m', memory: '32Mi' },
            },
            envFrom: [{ configMapRef: { name: name } }],
          },
        }],
      },
    }
    data[:spec][:serviceAccountName] = name if is_create_service_account
    data
  end
end
