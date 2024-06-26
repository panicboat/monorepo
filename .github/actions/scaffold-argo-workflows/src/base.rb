require 'fileutils'
require 'yaml'

require_relative 'base/cron_workflow'
require_relative 'base/role_binding'
require_relative 'base/service_account'
require_relative 'base/workflow_template'
require_relative 'lib/hash'

class BaseManifest
  private attr_reader :workspace, :service, :owner, :namespace, :kind, :name
  def initialize(workspace, service, owner, namespace, kind, name)
    @workspace = workspace
    @service = service
    @owner = owner
    @namespace = namespace
    @kind = kind
    @name = name
  end

  def create(is_create_config_map, is_create_service_account, is_create_blank_patches)
    # Kustomization
    FileUtils.mkdir_p(workspace)
    yaml = { apiVersion: 'kustomize.config.k8s.io/v1beta1', kind: 'Kustomization' }
    yaml = Hash.deep_symbolize_keys(YAML.load_file("#{workspace}/kustomization.yaml")) if File.exist?("#{workspace}/kustomization.yaml")
    kustomization = _kustomization(yaml, is_create_config_map, is_create_service_account, is_create_blank_patches)
    YAML.dump(Hash.deep_transform_keys(kustomization, &:to_s), File.open("#{workspace}/kustomization.yaml", 'w')) if kustomization && !kustomization.empty?
    # ConfigMap
    FileUtils.mkdir_p("#{workspace}/configmap")
    configmap = _configMap(is_create_config_map, is_create_blank_patches)
    YAML.dump(Hash.deep_transform_keys(configmap, &:to_s), File.open("#{workspace}/configmap/#{name}.yaml", 'w')) if configmap && !configmap.empty?
    # ServiceAccount
    FileUtils.mkdir_p("#{workspace}/serviceaccount")
    serviceaccount = _serviceAccount(is_create_service_account)
    YAML.dump(Hash.deep_transform_keys(serviceaccount, &:to_s), File.open("#{workspace}/serviceaccount/#{name}.yaml", 'w')) if serviceaccount && !serviceaccount.empty?
    # RoleBinding
    FileUtils.mkdir_p("#{workspace}/rolebinding")
    rolebinding = _roleBinding(is_create_service_account)
    YAML.dump(Hash.deep_transform_keys(rolebinding, &:to_s), File.open("#{workspace}/rolebinding/#{name}.yaml", 'w')) if rolebinding && !rolebinding.empty?
    # Workflow
    FileUtils.mkdir_p("#{workspace}/#{kind.downcase}")
    workflow = _workflow(is_create_config_map, is_create_service_account)
    YAML.dump(Hash.deep_transform_keys(workflow, &:to_s), File.open("#{workspace}/#{kind.downcase}/#{name}.yaml", 'w')) if workflow && !workflow.empty?
  end

  private

  def _kustomization(values, is_create_config_map, is_create_service_account, is_create_blank_patches)
    values[:configMapGenerator].delete_if { |configmap| configmap[:name] == name } if values.key?(:configMapGenerator)
    values[:resources].delete_if { |configmap| configmap == "configmap/#{name}.yaml" } if values.key?(:resources)
    values[:resources].delete_if { |configmap| configmap == "serviceaccount/#{name}.yaml" } if values.key?(:resources)
    values[:resources].delete_if { |configmap| configmap == "rolebinding/#{name}.yaml" } if values.key?(:resources)
    values[:resources].delete_if { |configmap| configmap == "#{kind.downcase}/#{name}.yaml" } if values.key?(:resources)
    values[:patches].delete_if { |configmap| configmap[:path] == "configmap/#{name}.yaml" } if values.key?(:patches)
    if is_create_config_map
      # ConfigMapGenerator
      unless values.key?(:configMapGenerator)
        values[:configMapGenerator] = [{ name: name, options: { disableNameSuffixHash: true } }]
      else
        unless values[:configMapGenerator].any? { |configmap| configmap[:name] == name }
          values[:configMapGenerator] << { name: name, options: { disableNameSuffixHash: true } }
        end
      end
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
    end
    if is_create_service_account
      # ServiceAccount
      unless values.key?(:resources)
        values[:resources] = ["serviceaccount/#{name}.yaml"]
      else
        unless values[:resources].any? { |resource| resource == "serviceaccount/#{name}.yaml" }
          values[:resources] << "serviceaccount/#{name}.yaml"
        end
      end
      # RoleBinding
      unless values.key?(:resources)
        values[:resources] = ["rolebinding/#{name}.yaml"]
      else
        unless values[:resources].any? { |resource| resource == "rolebinding/#{name}.yaml" }
          values[:resources] << "rolebinding/#{name}.yaml"
        end
      end
    end
    # Workflow
    unless values.key?(:resources)
      values[:resources] = ["#{kind.downcase}/#{name}.yaml"]
    else
      unless values[:resources].any? { |resource| resource == "#{kind.downcase}/#{name}.yaml" }
        values[:resources] << "#{kind.downcase}/#{name}.yaml"
      end
    end
    # OpenApi
    unless values.key?(:openapi)
      values[:openapi] = { path: 'https://raw.githubusercontent.com/argoproj/argo-schema-generator/main/schema/argo_all_k8s_kustomize_schema.json' }
    end
    values
  end

  def _configMap(is_create_config_map, is_create_blank_patches)
    configmap = nil
    configmap = { apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: name }, data: {} } if is_create_config_map && is_create_blank_patches
    configmap
  end

  def _serviceAccount(is_create_service_account)
    serviceaccount = nil
    serviceaccount = Base::ServiceAccount.new(service, owner, namespace, kind, name).create if is_create_service_account
    serviceaccount
  end

  def _roleBinding(is_create_service_account)
    rolebinding = nil
    rolebinding = Base::RoleBinding.new(service, owner, namespace, kind, name).create if is_create_service_account
    rolebinding
  end

  def _workflow(is_create_config_map, is_create_service_account)
    workflow = nil
    case kind
    when 'CronWorkflow'
      workflow = Base::CronWorkflow.new(service, owner, namespace, kind, name).create(is_create_config_map, is_create_service_account)
    when 'WorkflowTemplate'
      workflow = Base::WorkflowTemplate.new(service, owner, namespace, kind, name).create(is_create_config_map, is_create_service_account)
    end
    workflow
  end
end
