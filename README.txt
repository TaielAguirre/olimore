OLIMORE | Guía de implementación
================================

1. Estructura del proyecto
--------------------------
Subí toda la carpeta `olimoredigital` al hosting. La estructura final debe quedar dentro de `public_html` (o la carpeta raíz del dominio/subdominio) así:

```
public_html/
├── admin/
│   ├── config.php
│   ├── editar.php
│   ├── eliminar.php
│   ├── guardar.php
│   ├── index.php
│   ├── logout.php
│   ├── panel.php
│   ├── upload.php
│   └── vendor/ (generado por Composer)
├── data/
│   ├── productos.json
│   ├── images/
│   └── uploads/
├── images/
│   ├── logo.png
│   └── productos/
├── index.html
├── producto.html
├── script.js
├── style.css
└── productos_ejemplo.xlsx
```

2. Instalación de PhpSpreadsheet
--------------------------------
PhpSpreadsheet es el único paquete externo requerido y se instala con Composer dentro de la carpeta `admin`:

```
cd admin
composer require phpoffice/phpspreadsheet
```

Esto generará `admin/vendor/` y el archivo `vendor/autoload.php`. Si no contás con Composer en el servidor, podés instalarlo localmente, ejecutar el comando y subir el directorio `vendor/` completo al hosting.

3. Permisos de escritura
------------------------
El backend necesita escribir en:
- `data/productos.json`
- `data/uploads/`
- `images/productos/`

Asegurate de asignar permisos de escritura al usuario de PHP/Apache. En Hostinger, podés hacerlo desde el administrador de archivos seleccionando las carpetas y archivos mencionados y aplicando permisos `755` o `775` según la configuración del servidor.

4. Acceso al panel
------------------
- URL: `https://tudominio.com/admin/`
- Usuario: `admin`
- Contraseña: `TuPasswordSegura123`

La contraseña se valida con `password_verify`, por lo que podés cambiarla generando un nuevo hash en `admin/config.php` si lo necesitás.

5. Carga masiva por Excel
-------------------------
- Formato permitido: `.xlsx`
- Tamaño máximo: 5 MB
- Encabezados requeridos (en este orden): `categoria | nombre | descripcion | medida | precio_1 | precio_2 | imagen`
- Ejemplo disponible en `productos_ejemplo.xlsx`

El campo `imagen` debe contener una ruta relativa dentro de `images/productos/` (por ejemplo `images/productos/almendras.jpg`). El sistema sobrescribe `data/productos.json` con los datos del Excel y guarda copia del archivo cargado en `data/uploads/`.

6. Gestión manual
-----------------
Desde `admin/panel.php` podés:
- Crear, editar y eliminar productos.
- Subir una nueva imagen (se guarda con nombre único en `images/productos/`).
- Descargar la tabla en JSON (`data/productos.json`) para conservar un respaldo si lo deseás.

Recordá que el frontend (`index.html` y `producto.html`) lee directamente `data/productos.json`; cualquier cambio en el panel se refleja inmediatamente en la carta digital.
