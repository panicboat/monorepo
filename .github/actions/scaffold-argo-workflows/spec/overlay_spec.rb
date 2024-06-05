require 'rspec'
require_relative '../src/overlay'

describe 'Oase' do
  let(:env) do
    { workspace: '/app', service: 'service', owner: 'owner', namespace: 'namespace', kind: 'kind', name: 'name', }
  end
  let(:_overlay) { OverlayManifest.new(env[:workspace], env[:service], env[:owner], env[:namespace], env[:kind], env[:name]) }
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
      result = _overlay.send(:_kustomization, {}, false, true, true)
      expect(result).to be_a(Hash)
      expect(result[:configMapGenerator]).to be_nil
      expect(result[:resources]).to be_nil
      expect(result[:patches]).to be_a(Array)
      expect(result[:patches]).to eq([{path: "configmap/#{env[:name]}.yaml"}, {path: "serviceaccount/#{env[:name]}.yaml"}, {path: "rolebinding/#{env[:name]}.yaml"}, {path:"#{env[:kind]}/#{env[:name]}.yaml"}])
    end

    it 'returns the correct kustomization (add)' do
      result = _overlay.send(:_kustomization, kustomization, false, true, true)
      expect(result).to be_a(Hash)
      expect(result[:configMapGenerator]).to be_a(Array)
      expect(result[:configMapGenerator]).to eq(kustomization[:configMapGenerator])
      expect(result[:resources]).to be_a(Array)
      expect(result[:resources]).to eq(kustomization[:resources])
      expect(result[:patches]).to be_a(Array)
      expect(result[:patches]).to eq([{ path: "configmap/rspec-config.yaml" }, { path: "configmap/#{env[:name]}.yaml" }, {path: "serviceaccount/#{env[:name]}.yaml"}, {path: "rolebinding/#{env[:name]}.yaml"}, { path:"#{env[:kind]}/#{env[:name]}.yaml" }])
    end

    it 'returns the correct kustomization (replace)' do
      values = {
        configMapGenerator: [
          {name: env[:name], options: {disableNameSuffixHash: true}},
          { name: 'rspec-config', options: { disableNameSuffixHash: true } },
        ],
        resources: [
          "#{env[:kind]}/#{env[:name]}.yaml",
          "#{env[:kind]}/rspec-workflow.yaml",
        ],
        patches: [
          { path: "configmap/#{env[:name]}.yaml" },
          { path: "configmap/rspec-config.yaml" },
        ],
      }
      result = _overlay.send(:_kustomization, values, false, true, true)
      expect(result).to be_a(Hash)
      expect(result[:configMapGenerator]).to be_a(Array)
      expect(result[:configMapGenerator]).to eq(kustomization[:configMapGenerator])
      expect(result[:resources]).to be_a(Array)
      expect(result[:resources]).to eq(kustomization[:resources])
      expect(result[:patches]).to be_a(Array)
      expect(result[:patches]).to eq([{ path: "configmap/rspec-config.yaml" }, { path: "configmap/#{env[:name]}.yaml" }, {path: "serviceaccount/#{env[:name]}.yaml"}, {path: "rolebinding/#{env[:name]}.yaml"}, { path: "#{env[:kind]}/#{env[:name]}.yaml" }])
    end

    it 'returns the correct kustomization (do not create blank patches)' do
      result = _overlay.send(:_kustomization, kustomization, false, true, true)
      expect(result).to be_a(Hash)
      expect(result[:configMapGenerator]).to be_a(Array)
      expect(result[:configMapGenerator]).to eq(kustomization[:configMapGenerator])
      expect(result[:resources]).to be_a(Array)
      expect(result[:resources]).to eq(kustomization[:resources])
      expect(result[:patches]).to be_a(Array)
      expect(result[:patches]).to eq(kustomization[:patches])
    end

    it 'returns the correct kustomization (All patterns of flags)' do
      # overlay target, do not create service account, create blank patches
      result = _overlay.send(:_kustomization, {}, true, false, true)
      expect(result[:patches]).to eq([{path: "configmap/#{env[:name]}.yaml"}, {path:"#{env[:kind]}/#{env[:name]}.yaml"}])
      # overlay target, create service account, do not create blank patches
      result = _overlay.send(:_kustomization, {}, true, true, false)
      expect(result[:patches]).to be_nil
      # overlay target, create service account, create blank patches
      result = _overlay.send(:_kustomization, {}, true, true, true)
      expect(result[:patches]).to eq([{path: "configmap/#{env[:name]}.yaml"}, {path:"#{env[:kind]}/#{env[:name]}.yaml"}])
      # do not overlay target, do not create service account, do not create blank patches
      result = _overlay.send(:_kustomization, {}, false, false, false)
      expect(result[:patches]).to eq([{path: "configmap/#{env[:name]}.yaml"}, {path:"#{env[:kind]}/#{env[:name]}.yaml"}])
      # do not overlay target, do not create service account, create blank patches
      result = _overlay.send(:_kustomization, {}, false, false, true)
      expect(result[:patches]).to eq([{path: "configmap/#{env[:name]}.yaml"}, {path:"#{env[:kind]}/#{env[:name]}.yaml"}])
      # do not overlay target, create service account, do not create blank patches
      result = _overlay.send(:_kustomization, {}, false, true, false)
      expect(result[:patches]).to eq([{path: "configmap/#{env[:name]}.yaml"}, {path: "serviceaccount/#{env[:name]}.yaml"}, {path:"rolebinding/#{env[:name]}.yaml"}, {path:"#{env[:kind]}/#{env[:name]}.yaml"}])
      # do not overlay target, create service account, create blank patches
      result = _overlay.send(:_kustomization, {}, false, true, true)
      expect(result[:patches]).to eq([{path: "configmap/#{env[:name]}.yaml"}, {path: "serviceaccount/#{env[:name]}.yaml"}, {path:"rolebinding/#{env[:name]}.yaml"}, {path:"#{env[:kind]}/#{env[:name]}.yaml"}])
    end
  end

  describe '#_configMap' do
    it 'returns the correct ConfigMap (create blank patch)' do
      result = _overlay.send(:_configMap, true, true)
      expect(result).to be_a(Hash)
      expect(result[:apiVersion]).to eq('v1')
      expect(result[:kind]).to eq('ConfigMap')
      expect(result[:metadata][:name]).to eq(env[:name])
      expect(result[:data]).to be_a(Hash)
      expect(result[:data]).to eq({})
      expect(result[:'$patch']).to eq(nil)
    end

    it 'returns the correct ConfigMap (create delete patch)' do
      result = _overlay.send(:_configMap, false, true)
      expect(result).to be_a(Hash)
      expect(result[:apiVersion]).to eq('v1')
      expect(result[:kind]).to eq('ConfigMap')
      expect(result[:metadata][:name]).to eq(env[:name])
      expect(result[:data]).to be_a(Hash)
      expect(result[:data]).to eq({})
      expect(result[:'$patch']).to eq('delete')
    end

    it 'returns the correct ConfigMap (create delete patch)' do
      result = _overlay.send(:_configMap, true, false)
      expect(result).to be_nil
    end

    it 'returns the correct ConfigMap (create delete patch)' do
      result = _overlay.send(:_configMap, false, false)
      expect(result).to be_a(Hash)
      expect(result[:apiVersion]).to eq('v1')
      expect(result[:kind]).to eq('ConfigMap')
      expect(result[:metadata][:name]).to eq(env[:name])
      expect(result[:data]).to be_a(Hash)
      expect(result[:data]).to eq({})
      expect(result[:'$patch']).to eq('delete')
    end
  end

  describe '#_serviceAccount' do
    it 'returns the correct ServiceAccount (create delete patch)' do
      result = _overlay.send(:_serviceAccount, false, true)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('ServiceAccount')
      expect(result[:'$patch']).to eq('delete')
    end

    it 'returns the correct ServiceAccount (do not create)' do
      result = _overlay.send(:_serviceAccount, true, true)
      expect(result).to be_nil
      result = _overlay.send(:_serviceAccount, true, false)
      expect(result).to be_nil
      result = _overlay.send(:_serviceAccount, false, false)
      expect(result).to be_nil
    end
  end

  describe '#_roleBinding' do
    it 'returns the correct RoleBinding (create delete patch)' do
      result = _overlay.send(:_roleBinding, false, true)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('RoleBinding')
      expect(result[:'$patch']).to eq('delete')
    end

    it 'returns the correct RoleBinding (do not create)' do
      result = _overlay.send(:_roleBinding, true, true)
      expect(result).to be_nil
      result = _overlay.send(:_roleBinding, true, false)
      expect(result).to be_nil
      result = _overlay.send(:_roleBinding, false, false)
      expect(result).to be_nil
    end
  end

  describe '#_workflow' do
    it 'returns the correct ConfigMap (create blank patch)' do
      overlay = OverlayManifest.new(env[:workspace], env[:service], env[:owner], env[:namespace], 'CronWorkflow', env[:name])
      result = overlay.send(:_workflow, true, true)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('CronWorkflow')
      expect(result[:'$patch']).to eq(nil)
    end

    it 'returns the correct ConfigMap (create delete patch)' do
      overlay = OverlayManifest.new(env[:workspace], env[:service], env[:owner], env[:namespace], 'CronWorkflow', env[:name])
      result = overlay.send(:_workflow, false, true)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('CronWorkflow')
      expect(result[:'$patch']).to eq('delete')
    end

    it 'returns the correct ConfigMap (create delete patch)' do
      overlay = OverlayManifest.new(env[:workspace], env[:service], env[:owner], env[:namespace], 'CronWorkflow', env[:name])
      result = overlay.send(:_workflow, true, false)
      expect(result).to be_nil
    end

    it 'returns the correct ConfigMap (create delete patch)' do
      overlay = OverlayManifest.new(env[:workspace], env[:service], env[:owner], env[:namespace], 'WorkflowTemplate', env[:name])
      result = overlay.send(:_workflow, false, false)
      expect(result).to be_a(Hash)
      expect(result[:kind]).to eq('WorkflowTemplate')
      expect(result[:'$patch']).to eq('delete')
    end
  end
end
