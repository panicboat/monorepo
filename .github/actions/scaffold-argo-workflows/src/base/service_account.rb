require_relative 'workflow_base'

class Base::ServiceAccount < Base::WorkflowBase
  def create(service_account)
    data = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: { name: service_account, },
    }
  end
end
