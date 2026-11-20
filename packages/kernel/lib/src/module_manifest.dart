/// Describes an installable Tessera module.
class ModuleManifest {
  const ModuleManifest({
    required this.id,
    required this.name,
    required this.version,
    this.kind = ModuleKind.rest,
    this.endpoint,
    this.capabilities = const <String>[],
    this.description = '',
  });

  final String id;
  final String name;
  final String version;
  final ModuleKind kind;
  final String? endpoint;
  final List<String> capabilities;
  final String description;

  Map<String, Object?> toJson() => <String, Object?>{
        'id': id,
        'name': name,
        'version': version,
        'kind': kind.name,
        'endpoint': endpoint,
        'capabilities': capabilities,
        'description': description,
      };
}

enum ModuleKind { rest, webhook, oauth, mcp, builtin }
