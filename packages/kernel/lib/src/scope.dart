/// A permission scope requested by a module.
class ModuleScope {
  const ModuleScope({required this.resource, required this.actions});

  final String resource;
  final Set<String> actions;

  bool allows(String action) => actions.contains(action) || actions.contains('*');

  @override
  String toString() => '$resource:${actions.join(',')}';
}
