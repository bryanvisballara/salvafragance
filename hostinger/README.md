# Hostinger Deploy

Esta carpeta ya incluye los builds de produccion de ambos frontends apuntando al backend de Render:

- Storefront API: https://salvafragance.onrender.com/api
- Admin API: https://salvafragance.onrender.com/api

## Estructura

- `storefront/`: subir este contenido al dominio principal en Hostinger, por ejemplo `public_html/`
- `admin-portal/`: subir este contenido a un subdominio o carpeta del admin, por ejemplo `admin.tudominio.com/` o `public_html/admin/`

## Archivos incluidos

- `index.html`
- `assets/`
- imagenes y fuentes necesarias
- `.htaccess` para que funcionen las rutas SPA al recargar o abrir URLs internas

## Recomendacion de publicacion

1. Dominio principal: subir el contenido de `storefront/` a `public_html/`
2. Admin: subir el contenido de `admin-portal/` a la carpeta del subdominio admin
3. Backend: mantenerlo en Render
4. Si Hostinger cachea contenido viejo, limpiar cache del navegador y del hosting

## Notas

- No subas la carpeta completa `hostinger/` dentro de `public_html/`; sube el contenido de cada app al destino correcto.
- Si montas el admin dentro de una subcarpeta y no en un subdominio, puede requerir ajustar `RewriteBase` y el `base` de Vite.
- El backend no va dentro de Hostinger en este paquete.
