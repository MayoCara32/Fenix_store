# Tiendita Fénix

WebApp móvil de autoservicio construida con Next.js, TypeScript y Tailwind CSS. Las compras se registran como saldo pendiente en Google Sheets; no procesa pagos.

## Configuración

1. Instala Node.js 20 o superior y ejecuta `npm install`.
2. Crea una hoja de cálculo con estas pestañas y encabezados exactos en la primera fila:
   - `Inventario`: `id_producto`, `nombre`, `precio`, `stock_actual`, `stock_minimo`, `alerta_enviada`.
   - `Usuarios`: `nombre_completo`, `saldo_pendiente`, `fecha_registro`.
   - `Ventas`: `id_venta`, `fecha_hora`, `nombre_usuario`, `producto`, `cantidad`, `total`, `estado_pago`.
3. Habilita Google Sheets API en Google Cloud, crea una cuenta de servicio y comparte la hoja con su correo con permisos de editor. Cada producto debe tener un ID único; precios y existencias deben ser numéricos. Usa `FALSE` en `alerta_enviada`.
4. Copia `.env.example` a `.env.local` y completa las credenciales. Conserva los saltos de línea de la clave privada como `\n`. Configura Twilio con un remitente de WhatsApp habilitado y un destinatario autorizado. Si no configuras Twilio, las compras funcionan pero no se envían alertas.
5. Ejecuta `npm run dev` y abre `http://localhost:3000`. Para producción ejecuta `npm run build`.
6. Importa el repositorio en Vercel, configura las mismas variables de entorno en el proyecto y despliega. Genera un código QR con la URL HTTPS del despliegue para colocarlo en el taller.

Cada compra crea una fila en `Ventas` por producto, con el mismo ID de venta. El nombre identifica al usuario sin distinguir mayúsculas y minúsculas; se crea automáticamente si no existe. Cuando las existencias llegan al mínimo, se intenta enviar un WhatsApp y se marca `alerta_enviada` solo después de enviarlo. Al reabastecer, restablece esa celda a `FALSE` para permitir una nueva alerta.

## Limitaciones operativas

Google Sheets no ofrece transacciones ni bloqueo entre solicitudes. Dos compras simultáneas pueden sobrescribir existencias o saldos; para producción con concurrencia se necesita una base de datos transaccional o un servicio de serialización externo. Una falla entre el registro de ventas y la actualización de inventario/saldo requiere conciliación manual; el mensaje incluye el ID de venta. El nombre no verifica identidad: cualquier persona con la URL puede registrar una compra a nombre de otra. Restringe el acceso o agrega autenticación antes de depender de los saldos. Las alertas son de mejor esfuerzo y pueden requerir configuración y aprobación de plantillas en WhatsApp/Twilio.
