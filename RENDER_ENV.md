Variables recomendadas para Render

Backend API

PORT=10000
NODE_ENV=production
MONGODB_URI=<tu_uri_de_mongodb>
MONGODB_DB=salvafragance
JWT_SECRET=salvafragance_admin_change_this_secret
ADMIN_EMAIL=cfrap555@gmail.com
ADMIN_ORDER_EMAIL=cfrap555@gmail.com
ADMIN_PASSWORD=123456
CLIENT_URL=https://savalfragance.com,https://www.savalfragance.com,https://salvafragance.onrender.com
BREVO_API_KEY=<tu_brevo_api_key>
BREVO_SENDER_EMAIL=orders@savalfragance.com
BREVO_SENDER_NAME=Saval Fragance
CLOUDINARY_CLOUD_NAME=Saval Fragance
CLOUDINARY_API_KEY=<tu_cloudinary_api_key>
CLOUDINARY_API_SECRET=<tu_cloudinary_api_secret>
CLOUDINARY_UPLOAD_FOLDER=saval-fragance/products

Frontend Admin

VITE_APP_NAME=Saval Fragance Admin
VITE_API_URL=https://salvafragance.onrender.com/api

Frontend Storefront

VITE_APP_NAME=Saval Fragance Storefront
VITE_API_URL=https://salvafragance.onrender.com/api

Notas

- En MongoDB Atlas conviene usar una base especifica, por ejemplo `salvafragance`.
- `ADMIN_EMAIL` y `ADMIN_PASSWORD` corresponden al seed inicial del login administrativo.
- `ADMIN_ORDER_EMAIL` es opcional; si existe, recibira las notificaciones de nuevas ordenes del checkout. Si no existe, se usa `ADMIN_EMAIL`.
- `JWT_SECRET` debe cambiarse por un valor largo y privado antes de produccion real.
- Brevo enviara el correo de pedido recibido y el correo con numero de seguimiento.
- Cloudinary requiere `CLOUDINARY_CLOUD_NAME`; aqui quedo configurado como `Saval Fragance`, pero si Cloudinary devuelve error de credenciales revisa que sea el cloud name tecnico exacto de tu consola.