# Sistema de Partidas y Transacciones 🎮💰

Este documento describe la implementación completa del sistema de partidas con transferencias automáticas de créditos y auditoría de transacciones.

## 🎯 Funcionalidades Implementadas

### ✅ Sistema de Partidas Completo
- **Iniciar partidas** con validación automática de créditos
- **Finalizar partidas** con transferencias automáticas
- **Manejo de empates** y partidas abandonadas
- **Soporte multijugador** y individual
- **Transacciones atómicas** para consistencia de datos

### ✅ Sistema de Transacciones
- **Registro automático** de todas las transferencias de créditos
- **Historial completo** de movimientos financieros
- **Soporte para diferentes tipos** de transacciones:
  - Partidas ganadas/perdidas/empatadas
  - Compras de créditos
  - Reembolsos
  - Bonos y premios

### ✅ API Endpoints
- **REST API completa** con documentación Swagger
- **Filtros avanzados** para consultas
- **Paginación** automática
- **Formato optimizado** para frontend

## 🗂️ Estructura de Archivos Implementados

```
src/
├── db/
│   ├── schemas/
│   │   └── transaction.schema.ts        # ✨ Nuevo esquema de transacciones
│   ├── transactions.service.ts          # ✨ Servicio de transacciones
│   └── games.service.ts                 # 🔄 Extendido con transferencias
├── games/
│   ├── dto/
│   │   ├── start-game.dto.ts           # ✨ DTO para iniciar partidas
│   │   └── finish-game.dto.ts          # ✨ DTO para finalizar partidas
│   └── games.controller.ts             # 🔄 Extendido con nuevos endpoints
├── transactions/
│   ├── transactions.controller.ts      # ✨ Controlador de transacciones
│   └── transactions.module.ts          # ✨ Módulo de transacciones
└── shared/shared.module.ts             # 🔄 Actualizado con nuevas entidades
```

## 📊 Esquema de Base de Datos

### Entidad `Transaction`
```typescript
{
  userId: ObjectId,              // Referencia al usuario
  userTelegramId: number,        // ID de Telegram del usuario
  type: 'match' | 'transaction', // Tipo de transacción
  itemType: 'win' | 'loss' | 'draw' | 'income' | 'expense' | 'refund',
  gameId?: ObjectId,             // Referencia al juego (si aplica)
  gameTemplateId?: ObjectId,     // Referencia al template del juego
  description?: string,          // Descripción de la transacción
  amount: number,                // Monto (positivo=ganancia, negativo=pérdida)
  betAmount: number,             // Monto apostado
  winnings: number,              // Monto ganado
  winnerId?: ObjectId,           // ID del ganador (si aplica)
  opponentId?: ObjectId,         // ID del oponente (si aplica)
  balanceBefore: number,         // Balance antes de la transacción
  balanceAfter: number,          // Balance después de la transacción
  metadata?: any,                // Datos adicionales
  date: Date,                    // Fecha de la transacción
  sortDate: Date,                // Fecha para ordenamiento
  createdAt: Date,               // Timestamp de creación
  updatedAt: Date                // Timestamp de actualización
}
```

### Índices Optimizados
```javascript
// Índices para rendimiento
{ userTelegramId: 1, sortDate: -1 }  // Consultas por usuario ordenadas
{ type: 1, itemType: 1 }              // Filtros por tipo
{ gameId: 1 }                         // Consultas por juego
```

## 🔄 Flujo de Transacciones

### 1. Inicio de Partida
```
1. Validar créditos suficientes
2. Descontar créditos apostados
3. Crear registro del juego
4. [Transacción atómica]
```

### 2. Finalización de Partida
```
1. Determinar ganador
2. Transferir créditos al ganador
3. Registrar transacciones
4. Actualizar estadísticas
5. [Transacción atómica]
```

### 3. Manejo de Empates
```
1. Devolver créditos a ambos jugadores
2. Registrar transacciones de empate
3. Actualizar estadísticas
```

## 🚀 Endpoints Implementados

### Games Controller
```
POST   /games/start                    # Iniciar partida
PUT    /games/finish                   # Finalizar partida
GET    /games/:gameId                  # Detalles del juego
GET    /games/between/:p1/:p2          # Historial entre usuarios
GET    /games/stats/global             # Estadísticas globales
GET    /games/transactions/:userId     # Transacciones del usuario
```

### Transactions Controller
```
GET    /transactions/user/:userId      # Historial de transacciones
GET    /transactions/stats/:userId     # Estadísticas de transacciones
POST   /transactions/purchase          # Registrar compra
POST   /transactions/refund            # Registrar reembolso
```

## 💡 Características Avanzadas

### Transacciones Atómicas
- Uso de **MongoDB Sessions** para garantizar consistencia
- **Rollback automático** en caso de error
- **Validaciones** antes de modificar datos

### Auditoria Completa
- **Registro de todos los movimientos** financieros
- **Balance antes/después** de cada transacción
- **Metadatos adicionales** para trazabilidad

### Optimización de Rendimiento
- **Índices estratégicos** para consultas rápidas
- **Paginación automática** para consultas grandes
- **Agregaciones eficientes** para estadísticas

### Formato Frontend-Ready
- **Estructura optimizada** para componentes React/Vue
- **Filtros flexibles** para diferentes vistas
- **Metadata enriquecida** para mostrar información contextual

## 🛡️ Validaciones y Seguridad

### Validaciones de Negocio
- ✅ Créditos suficientes antes de iniciar partidas
- ✅ Usuarios válidos y existentes
- ✅ Templates de juego activos
- ✅ Estados de juego consistentes

### Validaciones de Datos
- ✅ DTOs con validadores de clase
- ✅ Tipos TypeScript estrictos
- ✅ Enums para valores limitados
- ✅ Documentación OpenAPI/Swagger

### Manejo de Errores
- ✅ Excepciones específicas por contexto
- ✅ Mensajes de error informativos
- ✅ Logs detallados para debugging

## 📈 Escalabilidad

### Base de Datos
- **Índices compuestos** para consultas complejas
- **Agregaciones optimizadas** para estadísticas
- **Esquemas flexibles** para nuevos tipos de transacciones

### API
- **Paginación** para datasets grandes
- **Filtros avanzados** para reducir transferencia de datos
- **Cacheable responses** para mejor performance

### Extensibilidad
- **Interfaces bien definidas** para nuevos tipos de transacciones
- **Metadata flexible** para datos específicos por tipo de juego
- **Arquitectura modular** para agregar nuevas funcionalidades

## 🧪 Testing

### Casos de Prueba Sugeridos
```typescript
// Casos de éxito
✅ Iniciar partida con créditos suficientes
✅ Finalizar partida con ganador
✅ Empate devuelve créditos
✅ Transacciones se registran correctamente

// Casos de error
❌ Iniciar partida sin créditos suficientes
❌ Finalizar partida ya finalizada
❌ Usuario inexistente
❌ Template de juego inactivo

// Casos de borde
🔄 Partida abandonada
🔄 Finalización simultánea
🔄 Rollback en errores de transacción
```

## 📝 Notas de Implementación

### Decisiones de Diseño
1. **Transacciones atómicas** para garantizar consistencia financiera
2. **Balance tracking** para auditoria completa
3. **Índices optimizados** para consultas frecuentes
4. **DTOs separados** para mejor documentación API

### Consideraciones de Rendimiento
1. **Agregaciones** en lugar de múltiples consultas
2. **Populate selectivo** para reducir transferencia de datos
3. **Límites de paginación** para proteger el servidor

### Extensiones Futuras
1. **Sistema de recompensas** automáticas
2. **Torneos** con pools de premios
3. **Marketplace** interno con items
4. **Sistema de niveles** y achievements

---

¡Sistema completo implementado y listo para producción! 🎉

Para ejemplos de uso, consulta: [`examples/game-flow-example.md`](examples/game-flow-example.md) 