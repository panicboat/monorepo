require_relative 'workflow_base'

class Base::RoleBinding < Base::WorkflowBase
  def create
    data = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { name: "#{name}", },
      subjects: [
        {
          kind: 'ServiceAccount',
          name: name,
          namespace: "${NAMESPACE}-#{namespace}"
        }
      ],
      roleRef: {
        kind: 'Role',
        name: 'argo',  # TODO: Changed after authority adjustment
        apiGroup: 'rbac.authorization.k8s.io'
      }
    }
  end
end
