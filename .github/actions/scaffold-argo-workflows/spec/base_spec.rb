require 'rspec'
require_relative '../src/base'

describe 'Base' do
  let(:env) do
    { workspace: '/app', service: 'service', owner: 'owner', namespace: 'namespace', kind: 'kind', name: 'name', service_account: 'service_account' }
  end
  let(:_base) { BaseManifest.new(env[:workspace], env[:service], env[:owner], env[:namespace], env[:kind], env[:name], env[:service_account]) }
  let(:kustomization) do
    {
      apiVersion: 'kustomize.config.k8s.io/v1beta1',
      kind: 'Kustomization',
      configMapGenerator: [
        { name: 'rspec-config', options: { disableNameSuffixHash: true } },
      ],
      resources: [
        "#{env[:kind]}/rspec-workflow.yaml",
      ],
      patches: [
        { path: "configmap/rspec-config.yaml" },
      ],
    }
  end

  describe '#_kustomization' do
    it 'returns the correct kustomization (create)' do
      result = _base.send(:_kustomization, {}, true)
      expect(result).to be_a(Hash)
      expect(result[:configMapGenerator]).to be_a(Array)
      expect(result[:configMapGenerator]).to eq([{name: env[:name], options: {disableNameSuffixHash: true}}])
      expect(result[:resources]).to be_a(Array)
      expect(result[:resources]).to eq(["serviceaccount/#{env[:service_account]}.yaml", "rolebinding/#{env[:name]}-#{env[:service_account]}.yaml", "#{env[:kind]}/#{env[:name]}.yaml"])
      expect(result[:patches]).to be_a(Array)
      expect(result[:patches]).to eq([{path: "configmap/#{env[:name]}.yaml"}])
    end

    it 'returns the correct kustomization (add)' do
      result = _base.send(:_kustomization, kustomization, true)
      expect(result).to be_a(Hash)
      expect(result[:configMapGenerator]).to be_a(Array)
      expect(result[:configMapGenerator]).to eq([{ name: 'rspec-config', options: { disableNameSuffixHash: true } }, {name: env[:name], options: {disableNameSuffixHash: true}}])
      expect(result[:resources]).to be_a(Array)
      expect(result[:resources]).to eq(["#{env[:kind]}/rspec-workflow.yaml", "serviceaccount/#{env[:service_account]}.yaml", "rolebinding/#{env[:name]}-#{env[:service_account]}.yaml", "#{env[:kind]}/#{env[:name]}.yaml"])
      expect(result[:patches]).to be_a(Array)
      expect(result[:patches]).to eq([{ path: "configmap/rspec-config.yaml" }, { path: "configmap/#{env[:name]}.yaml" }])
    end

    it 'returns the correct kustomization (replace)' do
      values = {
        configMapGenerator: [
          {name: env[:name], options: {disableNameSuffixHash: true}},
          { name: 'rspec-config', options: { disableNameSuffixHash: true } },
        ],
        resources: [
          "serviceaccount/#{env[:name]}.yaml",
          "rolebinding/#{env[:name]}.yaml",
          "#{env[:kind]}/#{env[:name]}.yaml",
          "#{env[:kind]}/rspec-workflow.yaml",
        ],
        patches: [
          { path: "configmap/#{env[:name]}.yaml" },
          { path: "configmap/rspec-config.yaml" },
        ],
      }
      result = _base.send(:_kustomization, values, true)
      expect(result).to be_a(Hash)
      expect(result[:configMapGenerator]).to be_a(Array)
      expect(result[:configMapGenerator]).to eq([{ name: 'rspec-config', options: { disableNameSuffixHash: true } }, {name: env[:name], options: {disableNameSuffixHash: true}}])
      expect(result[:resources]).to be_a(Array)
      expect(result[:resources]).to eq(["#{env[:kind]}/rspec-workflow.yaml", "serviceaccount/#{env[:service_account]}.yaml", "rolebinding/#{env[:name]}-#{env[:service_account]}.yaml", "#{env[:kind]}/#{env[:name]}.yaml"])
      expect(result[:patches]).to be_a(Array)
      expect(result[:patches]).to eq([{ path: "configmap/rspec-config.yaml" }, { path: "configmap/#{env[:name]}.yaml" }])
    end

    it 'returns the correct kustomization (do not create blank patches)' do
      result = _base.send(:_kustomization, kustomization, false)
      expect(result).to be_a(Hash)
      expect(result[:configMapGenerator]).to be_a(Array)
      expect(result[:configMapGenerator]).to eq([{ name: 'rspec-config', options: { disableNameSuffixHash: true } }, {name: env[:name], options: {disableNameSuffixHash: true}}])
      expect(result[:resources]).to be_a(Array)
      expect(result[:resources]).to eq(["#{env[:kind]}/rspec-workflow.yaml", "serviceaccount/#{env[:service_account]}.yaml", "rolebinding/#{env[:name]}-#{env[:service_account]}.yaml", "#{env[:kind]}/#{env[:name]}.yaml"])
      expect(result[:patches]).to be_a(Array)
      expect(result[:patches]).to eq([{ path: "configmap/rspec-config.yaml" }])
    end
  end

  describe '#_configMap' do
    it 'returns the correct ConfigMap (create)' do
      result = _base.send(:_configMap, true)
      expect(result).to be_a(Hash)
      expect(result[:apiVersion]).to eq('v1')
      expect(result[:kind]).to eq('ConfigMap')
      expect(result[:metadata][:name]).to eq(env[:name])
      expect(result[:data]).to be_a(Hash)
      expect(result[:data]).to eq({})
    end

    it 'returns the correct ConfigMap (do not create)' do
      result = _base.send(:_configMap, false)
      expect(result).to be(nil)
    end
  end

  describe '#_serviceAccount' do
    it 'returns the correct ServiceAccount' do
      result = _base.send(:_serviceAccount)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('ServiceAccount')
    end
  end

  describe '#_roleBinding' do
    it 'returns the correct RoleBinding' do
      result = _base.send(:_roleBinding)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('RoleBinding')
    end
  end

  describe '#_workflow' do
    it 'returns the correct CronWorkflow' do
      base = BaseManifest.new(env[:workspace], env[:service], env[:owner], env[:namespace], 'CronWorkflow', env[:name], env[:service_account])
      result = base.send(:_workflow)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('CronWorkflow')
    end

    it 'returns the correct WorkflowTemplate' do
      base = BaseManifest.new(env[:workspace], env[:service], env[:owner], env[:namespace], 'WorkflowTemplate', env[:name], env[:service_account])
      result = base.send(:_workflow)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('WorkflowTemplate')
    end
  end
end
