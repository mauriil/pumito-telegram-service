# API para Generar Links de Pago

## Endpoint: POST `/api/payments/create-payment-link`

Este endpoint permite generar un link de pago personalizado para que un usuario pueda adquirir un pack de créditos específico.

### Descripción del Flujo Actual

El proyecto actualmente genera links de pago a través del servicio `PaymentsService.createInvoice()` que:

1. **Crea un registro de pago** en la base de datos con estado `pending`
2. **Genera el link de pago** usando diferentes métodos:
   - **MercadoPago**: Para pagos con tarjeta/efectivo (Argentina)
   - **USDT TRC20**: Para pagos con criptomonedas USDT en red Tron
   - **USDT BEP20**: Para pagos con criptomonedas USDT en BSC
   - **BTC**: Para pagos con Bitcoin
3. **Actualiza el registro** con la URL generada
4. **Expira automáticamente** después de 30 minutos si no se confirma

### Request

**URL**: `POST /api/payments/create-payment-link`

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
  "userId": "string",          // ID del usuario (requerido)
  "packId": "string",          // ID del pack a comprar (requerido)
  "paymentMethod": "string"    // Método de pago (opcional, default: "mercadopago")
}
```

**Métodos de pago disponibles**:
- `mercadopago` (default)
- `USDT_TRC20`
- `USDT_BEP20`
- `BTC`

### Response

**Éxito (200)**:
```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://mercadopago.com.ar/checkout/v1/redirect?preference-id=...",
    "paymentId": "64f1234567890abcdef12345",
    "amount": 19.99,
    "credits": 2500,
    "packTitle": "Pack Premium",
    "paymentMethod": "mercadopago",
    "expiresAt": "2024-01-15T11:00:00.000Z"
  },
  "message": "Link de pago generado exitosamente",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error (400 - Bad Request)**:
```json
{
  "success": false,
  "message": "El usuario no puede realizar compras: Usuario bloqueado",
  "statusCode": 400
}
```

**Error (404 - Not Found)**:
```json
{
  "success": false,
  "message": "Pack no encontrado",
  "statusCode": 404
}
```

### Ejemplos de Uso

#### 1. Generar link con MercadoPago (default)
```bash
curl -X POST http://localhost:3000/api/payments/create-payment-link \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123456789",
    "packId": "premium-pack-2024"
  }'
```

#### 2. Generar link con USDT TRC20
```bash
curl -X POST http://localhost:3000/api/payments/create-payment-link \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123456789",
    "packId": "premium-pack-2024",
    "paymentMethod": "USDT_TRC20"
  }'
```

### Validaciones del Sistema

El endpoint realiza las siguientes validaciones:

1. **Usuario existe**: Verifica que el userId sea válido
2. **Usuario puede comprar**: Verifica que el usuario no esté bloqueado
3. **Pack existe**: Verifica que el packId sea válido
4. **Pack activo**: Verifica que el pack esté disponible para compra
5. **Cancelación de pagos pendientes**: Si existe un pago pendiente del mismo usuario, lo cancela automáticamente

### Webhook de Confirmación

Una vez que el usuario realiza el pago, MercadoPago notifica al sistema a través del webhook:
- **URL**: `POST /webhook/mercadopago`
- **Función**: Actualiza el estado del pago y añade créditos al usuario
- **Estados posibles**: `confirmed`, `rejected`, `error`

### Información Técnica

**Servicios utilizados**:
- `PaymentsService`: Gestión de pagos en base de datos
- `CreditPacksService`: Información de packs disponibles  
- `UsersService`: Validación de usuarios y permisos
- `MercadoPagoService`: Integración con MercadoPago API

**Base de datos**:
- Crea un documento en la colección `payments` con estado `pending`
- Expira automáticamente después de 30 minutos
- Se actualiza vía webhook cuando se confirma el pago

**Seguridad**:
- Valida que el usuario existe y puede hacer compras
- Cancela automáticamente pagos pendientes anteriores
- Registra todas las operaciones en logs para auditoría 