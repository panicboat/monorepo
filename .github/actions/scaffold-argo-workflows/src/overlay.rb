require 'fileutils'
require 'yaml'

require_relative 'overlay/cron_workflow'
require_relative 'overlay/workflow_template'
require_relative 'lib/hash'

class Overlay
  private attr_reader :workspace, :service, :owner, :namespace, :kind, :name
  def initialize(workspace, service, owner, namespace, kind, name)
    @workspace = workspace
    @service = service
    @owner = owner
    @namespace = namespace
    @kind = kind
    @name = name
  end

  def create(is_overlay_target, is_create_blank_patches)
    # Kustomization
    FileUtils.mkdir_p(workspace)
    yaml = { apiVersion: 'kustomize.config.k8s.io/v1beta1', kind: 'Kustomization', namespace: "${NAMESPACE}-#{namespace}", resources: ['../../base'] }
    yaml = Hash.deep_symbolize_keys(YAML.load_file("#{workspace}/kustomization.yaml")) if File.exist?("#{workspace}/kustomization.yaml")
    kustomization = _kustomization(yaml, is_create_blank_patches)
    YAML.dump(Hash.deep_transform_keys(kustomization, &:to_s), File.open("#{workspace}/kustomization.yaml", 'w'))
    if is_create_blank_patches
      # ConfigMap
      FileUtils.mkdir_p("#{workspace}/configmap")
      configmap = { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: name }, data: {} }
      YAML.dump(Hash.deep_transform_keys(configmap, &:to_s), File.open("#{workspace}/configmap/#{name}.yaml", 'w'))
      # Workflow
      FileUtils.mkdir_p("#{workspace}/#{kind.downcase}")
      case kind
      when 'CronWorkflow'
        workflow = CronWorkflow.new(service, owner, namespace, kind, name).create
        YAML.dump(Hash.deep_transform_keys(workflow, &:to_s), File.open("#{workspace}/#{kind.downcase}/#{name}.yaml", 'w'))
      when 'WorkflowTemplate'
        workflow = WorkflowTemplate.new(service, owner, namespace, kind, name).create
        YAML.dump(Hash.deep_transform_keys(workflow, &:to_s), File.open("#{workspace}/#{kind.downcase}/#{name}.yaml", 'w'))
      end
    end
  end

  private

  def _kustomization(values, is_create_blank_patches)
    values[:configMapGenerator].delete_if { |configmap| configmap[:name] == name } if values.key?(:configMapGenerator)
    values[:resources].delete_if { |configmap| configmap == "configmap/#{name}.yaml" } if values.key?(:resources)
    values[:resources].delete_if { |configmap| configmap == "#{kind.downcase}/#{name}.yaml" } if values.key?(:resources)
    values[:patches].delete_if { |configmap| configmap[:path] == "configmap/#{name}.yaml" } if values.key?(:patches)
    # ConfigMap
    if is_create_blank_patches
      unless values.key?(:patches)
        values[:patches] = [{ path: "configmap/#{name}.yaml" }]
      else
        unless values[:patches].any? { |patch| patch[:path] == "configmap/#{name}.yaml" }
          values[:patches] << { path: "configmap/#{name}.yaml" }
        end
      end
    end
    # Workflow
    if is_create_blank_patches
      unless values.key?(:patches)
        values[:patches] = [{ path: "#{kind.downcase}/#{name}.yaml" }]
      else
        unless values[:patches].any? { |resource| resource == "#{kind.downcase}/#{name}.yaml" }
          values[:patches] << { path: "#{kind.downcase}/#{name}.yaml" }
        end
      end
    end
    # OpenApi
    unless values.key?(:openapi)
      values[:openapi] = { path: 'https://raw.githubusercontent.com/argoproj/argo-schema-generator/main/schema/argo_all_k8s_kustomize_schema.json' }
    end
    values
  end
end
