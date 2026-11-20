# tessera_kernel

Контракты ядра Tessera: манифесты модулей и scope-права.

Пакет не содержит рантайма и предназначен для описания модулей, которые затем
подключаются веб- и Android-клиентами через REST/MCP-контракты.

```dart
import 'package:tessera_kernel/kernel.dart';

const manifest = ModuleManifest(
  id: 'github',
  name: 'GitHub',
  version: '1.0.0',
  kind: ModuleKind.oauth,
  endpoint: 'https://api.github.com',
  capabilities: ['repo:read', 'issues:write'],
);
```
