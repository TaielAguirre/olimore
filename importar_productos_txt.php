<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

// Verificar autenticación
require_login();

// Función para normalizar precios
function normalizePrice($value): ?float {
    if ($value === null || $value === '') { return null; }
    $value = trim((string)$value);
    if ($value === '') { return null; }
    
    // Ignorar valores que no son precios (como "1 caja", "2 caja", "NUEVO", "OFERTAS")
    if (preg_match('/^(caja|unid|nuevo|ofertas|surtidas?)$/i', $value)) {
        return null;
    }
    
    // Ignorar valores como "1 caja", "2 caja", etc.
    if (preg_match('/^\d+\s*(caja|unid)$/i', $value)) {
        return null;
    }
    
    // Si el texto contiene palabras como "o mas", "UNID", "KG", etc., no es un precio directo
    // Solo procesar si parece ser un número puro o con formato de precio
    if (preg_match('/[a-zA-Z]/', $value) && !preg_match('/^\d+([.,]\d+)?\s*\$?$/', $value)) {
        // Si tiene letras y no es un formato simple de precio, no procesar aquí
        // (se procesará en detectDiscountInText)
        return null;
    }
    
    // Remover símbolos de moneda y espacios
    $normalized = preg_replace('/[^0-9.,-]/', '', $value);
    if ($normalized === null || $normalized === '') { return null; }
    
    // Detectar formato del número
    $lastDot = strrpos($normalized, '.');
    $lastComma = strrpos($normalized, ',');
    
    if ($lastDot !== false && $lastComma !== false) {
        if ($lastDot > $lastComma) {
            $normalized = str_replace('.', '', $normalized);
            $normalized = str_replace(',', '.', $normalized);
        } else {
            $normalized = str_replace(',', '', $normalized);
        }
    } elseif ($lastComma !== false) {
        $afterComma = substr($normalized, $lastComma + 1);
        if (strlen($afterComma) === 2) {
            $normalized = str_replace(',', '.', $normalized);
        } else {
            $normalized = str_replace(',', '', $normalized);
        }
    } elseif ($lastDot !== false) {
        $afterDot = substr($normalized, $lastDot + 1);
        if (strlen($afterDot) === 3) {
            $normalized = str_replace('.', '', $normalized);
        }
    }
    
    if (!is_numeric($normalized)) { return null; }
    $price = (float) $normalized;
    
    // Validar que el precio sea razonable (entre 1 y 1000000)
    if ($price < 1 || $price > 1000000) {
        return null;
    }
    
    return $price;
}

// Función para detectar descuentos en texto
// $precioBase puede ser precio1kg o precio500 (precio1), dependiendo de qué esté disponible
function detectDiscountInText($text, $precioBase): array {
    $oferta = false;
    $ofertaPrecio2 = null;
    $descripcion = '';
    
    if (empty($text)) {
        return ['oferta' => false, 'oferta_precio_2' => null, 'descripcion' => ''];
    }
    
    $text = trim($text);
    
    // Ignorar "NUEVO", "OFERTAS"
    if (preg_match('/^(NUEVO|OFERTAS)$/i', $text)) {
        return ['oferta' => false, 'oferta_precio_2' => null, 'descripcion' => ''];
    }
    
    // Detectar "X 5 KG 1590PESOS" o "X 5KG $ 4100"
    // IMPORTANTE: El precio es por kilo cuando compras X kg o más (NO el total)
    if (preg_match('/X\s*(\d+(?:[.,]\d+)?)\s*KG\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(?:PESOS|pesos)?/i', $text, $matches)) {
        $cantidad = $matches[1];
        $precio = normalizePrice($matches[2]);
        if ($precio !== null && $precio > 0) {
            $oferta = true;
            $ofertaPrecio2 = $precio;
            $descripcion = 'Comprando ' . $cantidad . 'KG o más, el kilo sale $' . number_format($precio, 0, ',', '.');
        }
    }
    // Detectar "X 6 UNID $ 900" o "X 12 UNID $ 4400" o "X 6 UNID 10900" (sin $)
    // IMPORTANTE: El precio es por unidad cuando compras X unidades o más
    elseif (preg_match('/X\s*(\d+)\s*UNID\s*\$?\s*(\d+(?:[.,]\d+)?)/i', $text, $matches)) {
        $cantidad = $matches[1];
        $precio = normalizePrice($matches[2]);
        if ($precio !== null && $precio > 0) {
            $oferta = true;
            $ofertaPrecio2 = $precio;
            $descripcion = 'Comprando ' . $cantidad . ' unidades o más, cada una sale $' . number_format($precio, 0, ',', '.');
        }
    }
    // Detectar "12 o mas $ 9700" o "12 o más $ 9700"
    // IMPORTANTE: El precio es por unidad cuando compras X o más
    elseif (preg_match('/(\d+)\s*o\s*m[aá]s\s*\$?\s*(\d+(?:[.,]\d+)?)/i', $text, $matches)) {
        $cantidad = $matches[1];
        $precio = normalizePrice($matches[2]);
        if ($precio !== null && $precio > 0) {
            $oferta = true;
            $ofertaPrecio2 = $precio;
            $descripcion = 'Comprando ' . $cantidad . ' o más, cada uno sale $' . number_format($precio, 0, ',', '.');
        }
    }
    // Detectar "X 12 surtidas $ 2750"
    // IMPORTANTE: El precio es por unidad cuando compras X surtidas o más
    elseif (preg_match('/X\s*(\d+)\s*surtidas?\s*\$?\s*(\d+(?:[.,]\d+)?)/i', $text, $matches)) {
        $cantidad = $matches[1];
        $precio = normalizePrice($matches[2]);
        if ($precio !== null && $precio > 0) {
            $oferta = true;
            $ofertaPrecio2 = $precio;
            $descripcion = 'Comprando ' . $cantidad . ' surtidas o más, cada una sale $' . number_format($precio, 0, ',', '.');
        }
    }
    // Detectar precio directo en columna 15KG (si es menor que el precio base)
    // IMPORTANTE: Es precio por kilo mejorado al comprar 15kg
    elseif (preg_match('/^\d+([.,]\d+)?$/', $text)) {
        $precio = normalizePrice($text);
        // precioBase puede ser precio1kg o precio500 (precio1)
        if ($precio !== null && $precio > 100 && $precioBase !== null && $precio < $precioBase) {
            $oferta = true;
            $ofertaPrecio2 = $precio;
            $descripcion = 'Comprando 15KG, el kilo sale $' . number_format($precio, 0, ',', '.') . ' en lugar de $' . number_format($precioBase, 0, ',', '.');
        }
    }
    // Detectar "5900X 2,5KG" (formato invertido)
    // IMPORTANTE: Calcular precio por kilo mejorado
    // Formato: precioTotal X cantidadKG = precio por kilo mejorado
    elseif (preg_match('/(\d+(?:[.,]\d+)?)\s*X\s*(\d+(?:[.,]\d+)?)\s*KG/i', $text, $matches)) {
        $precioTotal = normalizePrice($matches[1]);
        // Normalizar cantidadKg manualmente para manejar comas como decimales
        $cantidadStr = $matches[2];
        $cantidadStr = str_replace(',', '.', $cantidadStr); // Convertir coma a punto
        $cantidadKg = (float)$cantidadStr;
        
        if ($precioTotal !== null && $precioTotal > 0 && $cantidadKg > 0) {
            // Calcular precio por kilo: si compras cantidadKg, pagas precioTotal, entonces precio por kilo = precioTotal / cantidadKg
            $precioPorKilo = $precioTotal / $cantidadKg;
            $oferta = true;
            $ofertaPrecio2 = $precioPorKilo;
            // Formatear cantidadKg correctamente (mantener formato original con coma)
            $cantidadFormateada = str_replace('.', ',', number_format($cantidadKg, 1, '.', ''));
            $descripcion = 'Comprando ' . $cantidadFormateada . 'KG, el kilo sale $' . number_format($precioPorKilo, 0, ',', '.');
        }
    }
    
    return ['oferta' => $oferta, 'oferta_precio_2' => $ofertaPrecio2, 'descripcion' => $descripcion];
}

// Leer el archivo productos.txt
$txtFile = __DIR__ . '/../productos.txt';
if (!file_exists($txtFile)) {
    die("Error: No se encontró el archivo productos.txt\n");
}

$content = file_get_contents($txtFile);
if ($content === false) {
    die("Error: No se pudo leer el archivo productos.txt\n");
}

// Procesar líneas, uniendo las que están dentro de comillas
$lines = [];
$currentLine = '';
$inQuotes = false;
$quoteCount = 0;

foreach (explode("\n", $content) as $line) {
    $line = rtrim($line, "\r");
    
    // Contar comillas en la línea
    $quoteCount += substr_count($line, '"');
    
    // Si estamos acumulando una línea con comillas
    if ($inQuotes) {
        $currentLine .= "\n" . $line;
        // Si el número de comillas es par, cerramos las comillas
        if ($quoteCount % 2 === 0) {
            $inQuotes = false;
            $lines[] = $currentLine;
            $currentLine = '';
            $quoteCount = 0;
        }
    } 
    // Detectar inicio de comillas (línea que empieza con comillas)
    elseif (preg_match('/^[^\t]*"/', $line)) {
        $inQuotes = true;
        $currentLine = $line;
        // Si ya tiene comillas de cierre en la misma línea, no está en múltiples líneas
        if ($quoteCount % 2 === 0 && preg_match('/"[^\t]*\t/', $line)) {
            $inQuotes = false;
            $lines[] = $currentLine;
            $currentLine = '';
            $quoteCount = 0;
        }
    } 
    // Línea normal
    else {
        if ($currentLine !== '') {
            $lines[] = $currentLine;
            $currentLine = '';
        }
        $lines[] = $line;
        $quoteCount = 0;
    }
}

// Agregar última línea si queda pendiente
if ($currentLine !== '') {
    $lines[] = $currentLine;
}

// Lista exacta de categorías
$categoriasValidas = [
    'ESPECIAS Y CONDIMENTOS',
    'AHUMADOS',
    'INTEGRALES',
    'SEMILLAS',
    'LEGUMBRES',
    'HARINAS',
    'TE Y HIERBAS',
    'PRODUCTOS PRAGA SIN TACC',
    'PRODUCTOS SIN TACC',
    'SOPAS Y CALSOS ( argendiet )',
    'INFUSIONES PARA TE Y MATE',
    'ACEITES',
    'ENCURTIDOS – frasco vidrio',
    'SALES GOURMET',
    'MIX GOURMET',
    'VINAGRES',
    'ACEITUNAS',
    'CEREALES X KG',
    'CONGELADOS Be Berry',
    'FRUTOS SECOS',
    'PRODUCTOS ENVASADOS',
    'CHOCOLATES X KG',
    'GRANAS',
    'DULCE DE LECHE REPOSTERO',
    'MILKEY'
];

$productos = [];
$currentCategory = '';
$categories = [];

// Función para normalizar nombre de categoría (comparación flexible)
function normalizeCategoryName($name) {
    return trim(strtoupper($name));
}

// Procesar cada línea
foreach ($lines as $lineNum => $line) {
    // Saltar líneas de encabezado
    if ($lineNum < 2) { continue; }
    
    // Limpiar comillas del nombre si existen (pero mantener el contenido)
    // Primero unir líneas que están dentro de comillas
    $line = preg_replace('/^"([^"]+)"\t/', '$1\t', $line);
    // También limpiar comillas al final si quedaron
    $line = preg_replace('/\t"([^"]+)"$/', '\t$1', $line);
    
    // Dividir por tabs
    $parts = preg_split('/\t+/', $line);
    if (count($parts) < 1) { continue; }
    
    $nombre = trim($parts[0] ?? '');
    $precio500 = isset($parts[1]) ? trim($parts[1]) : '';
    $precio1kg = isset($parts[2]) ? trim($parts[2]) : '';
    $col15kg = isset($parts[3]) ? trim($parts[3]) : '';
    $col25kg = isset($parts[4]) ? trim($parts[4]) : '';
    
    // Si el nombre está vacío, saltar (pero mantener la categoría actual)
    if ($nombre === '') { continue; }
    
    // Limpiar saltos de línea del nombre
    $nombre = preg_replace('/\s*\n\s*/', ' ', $nombre);
    
    // Limpiar comillas finales si existen (ej: "MILKEY"")
    $nombre = rtrim($nombre, '"');
    
    // Limpiar tabs y espacios al final (hacerlo varias veces para asegurar)
    $nombre = preg_replace('/[\t]+/', ' ', $nombre); // Reemplazar tabs por espacios primero
    // Eliminar tabs y espacios al final de forma más agresiva
    $nombre = preg_replace('/[\t\s]+$/', '', $nombre); // Eliminar tabs y espacios al final
    $nombre = rtrim($nombre, "\t "); // Limpiar cualquier tab o espacio restante
    $nombre = trim($nombre); // Limpieza final
    // Limpieza adicional para asegurar que no queden tabs
    $nombre = str_replace("\t", " ", $nombre);
    $nombre = preg_replace('/\s+/', ' ', $nombre);
    $nombre = trim($nombre);
    
    // Verificar si es una categoría válida (comparación flexible)
    $nombreNormalizado = normalizeCategoryName($nombre);
    $esCategoria = false;
    $categoriaEncontrada = '';
    
    foreach ($categoriasValidas as $cat) {
        $catNormalizado = normalizeCategoryName($cat);
        // Comparación exacta o que el nombre empiece con la categoría
        if ($catNormalizado === $nombreNormalizado || 
            strpos($nombreNormalizado, $catNormalizado) === 0) {
            $esCategoria = true;
            $categoriaEncontrada = $cat;
            break;
        }
    }
    
    // Caso especial: "DULCE DE LECHE REPOSTERO\nMILKEY" es la categoría MILKEY
    // También "MILKEY" solo puede ser categoría si no tiene precios
    if (!$esCategoria) {
        // Si contiene "DULCE DE LECHE REPOSTERO" y "MILKEY" y no tiene precios, es categoría MILKEY
        $nombreSinEspacios = preg_replace('/\s+/', ' ', $nombre);
        if ((stripos($nombreSinEspacios, 'DULCE DE LECHE REPOSTERO') !== false && 
             stripos($nombreSinEspacios, 'MILKEY') !== false) ||
            (stripos($nombre, 'DULCE DE LECHE REPOSTERO') !== false && 
             stripos($nombre, 'MILKEY') !== false)) {
            // Verificar que no tenga precios válidos
            $precio1 = normalizePrice($precio500);
            $precio2 = normalizePrice($precio1kg);
            if ($precio1 === null && $precio2 === null && empty($precio500) && empty($precio1kg)) {
                $esCategoria = true;
                $categoriaEncontrada = 'MILKEY';
            }
        }
        // Si es solo "MILKEY" sin precios, también es categoría
        elseif (trim($nombre) === 'MILKEY' && empty($precio500) && empty($precio1kg)) {
            $precio1 = normalizePrice($precio500);
            $precio2 = normalizePrice($precio1kg);
            if ($precio1 === null && $precio2 === null) {
                $esCategoria = true;
                $categoriaEncontrada = 'MILKEY';
            }
        }
    }
    
    // Si es una categoría válida, establecerla como categoría actual
    if ($esCategoria) {
        $currentCategory = $categoriaEncontrada;
        if (!in_array($currentCategory, $categories)) {
            $categories[] = $currentCategory;
        }
        continue;
    }
    
    // Si no hay categoría actual, saltar (solo procesar productos dentro de categorías)
    // PERO: si la línea tiene precios, podría ser un producto que está después de una categoría
    // sin línea vacía, así que intentamos asignarlo a la última categoría conocida
    if ($currentCategory === '') {
        // Verificar si tiene precios válidos
        $hasValidPrice = false;
        if (!empty($precio500) && normalizePrice($precio500) !== null) {
            $hasValidPrice = true;
        }
        if (!empty($precio1kg) && normalizePrice($precio1kg) !== null) {
            $hasValidPrice = true;
        }
        // Si tiene precios pero no hay categoría, saltar (no podemos asignarlo)
        if ($hasValidPrice) {
            continue;
        }
        // Si no tiene precios, es probablemente una línea vacía o descripción
        continue;
    }
    
    // Si precio500 contiene texto como "400GR", "500GR", etc., agregarlo al nombre
    if (!empty($precio500) && preg_match('/^\d+\s*(GR|KG|ML|L)$/i', $precio500)) {
        $nombre .= ' ' . $precio500;
        $precio500 = isset($parts[2]) ? trim($parts[2]) : ''; // El siguiente campo es el precio real
        $precio1kg = isset($parts[3]) ? trim($parts[3]) : '';
        $col15kg = isset($parts[4]) ? trim($parts[4]) : '';
        $col25kg = isset($parts[5]) ? trim($parts[5]) : '';
    }
    
    // Si precio500 contiene formato "XKG $ 4500", extraer el precio y ponerlo en precio1kg
    // "XKG $ 4500" significa "por kilogramo, $4500 pesos" (precio base por kilo)
    // También puede estar en formato "XKG $ 4500" sin espacio antes del $
    if (!empty($precio500) && preg_match('/X\s*KG\s*\$?\s*(\d+(?:[.,]\d+)?)/i', $precio500, $matches)) {
        $precioExtraido = normalizePrice($matches[1]);
        if ($precioExtraido !== null) {
            $precio1kg = (string)$precioExtraido; // Convertir a string para mantener consistencia
            $precio500 = ''; // No hay precio 500GR
            // No limpiar col15kg aquí, puede tener información adicional de descuentos
        }
    }
    
    // Si col15kg tiene formato "XKG $ 4500" y no hay precio1kg, extraerlo
    // Esto es para casos como "GRANAS DE COLORES" que tiene "XKG $ 4500" en col15kg
    if (empty($precio1kg) && !empty($col15kg) && preg_match('/X\s*KG\s*\$?\s*(\d+(?:[.,]\d+)?)/i', $col15kg, $matches)) {
        $precioExtraido = normalizePrice($matches[1]);
        if ($precioExtraido !== null) {
            $precio1kg = (string)$precioExtraido;
        }
    }
    
    // Saltar descripciones (líneas que solo tienen guiones y texto, sin precios)
    // PERO solo si no tiene precios válidos (incluyendo los que se extrajeron arriba)
    if (preg_match('/^[A-ZÁÉÍÓÚÑ\s–\-]+$/', $nombre) && preg_match('/\s*[–\-]\s*/', $nombre)) {
        $hasPrices = false;
        if (!empty($precio500) && normalizePrice($precio500) !== null) {
            $hasPrices = true;
        }
        if (!empty($precio1kg) && normalizePrice($precio1kg) !== null) {
            $hasPrices = true;
        }
        if (!$hasPrices) {
            continue; // Saltar descripciones sin precios
        }
    }
    
    // Normalizar precios (después de extraer "XKG $ 4500" si estaba en precio500)
    $precio1 = normalizePrice($precio500);
    $precio2 = normalizePrice($precio1kg);
    
    // Si no tiene ningún precio válido, saltar (excepto si tiene descuento en texto)
    if ($precio1 === null && $precio2 === null) {
        // Verificar si tiene descuento en texto que podría ser un precio
        $hasDiscount = false;
        // Verificar col15kg (puede tener formato "XKG $ 4500" o descuentos)
        if (!empty($col15kg)) {
            // Primero verificar si es formato "XKG $ 4500"
            if (preg_match('/X\s*KG\s*\$?\s*(\d+(?:[.,]\d+)?)/i', $col15kg, $matches)) {
                $precioExtraido = normalizePrice($matches[1]);
                if ($precioExtraido !== null) {
                    $hasDiscount = true;
                    $precio2 = $precioExtraido; // Usar el precio como precio 1KG
                }
            } else {
                // Verificar si tiene descuento en texto
                $descuento15kg = detectDiscountInText($col15kg, null);
                if ($descuento15kg['oferta'] && $descuento15kg['oferta_precio_2'] !== null) {
                    $hasDiscount = true;
                    $precio2 = $descuento15kg['oferta_precio_2']; // Usar el precio de la oferta como precio 1KG
                } elseif (preg_match('/^\d+([.,]\d+)?$/', $col15kg)) {
                    $precioDirecto = normalizePrice($col15kg);
                    if ($precioDirecto !== null && $precioDirecto > 100) {
                        $hasDiscount = true;
                        $precio2 = $precioDirecto; // Usar como precio 1KG
                    }
                }
            }
        }
        if (!$hasDiscount && !empty($col25kg)) {
            if (preg_match('/^\d+([.,]\d+)?$/', $col25kg)) {
                $precioDirecto = normalizePrice($col25kg);
                if ($precioDirecto !== null && $precioDirecto > 100) {
                    $hasDiscount = true;
                    $precio2 = $precioDirecto; // Usar como precio 1KG
                }
            }
        }
        if (!$hasDiscount) {
            continue; // Saltar productos sin precios
        }
    }
    
    // Detectar descuentos
    // Detectar descuentos si tenemos un precio base (precio2 o precio1) para comparar
    $descuento15kg = ['oferta' => false, 'oferta_precio_2' => null, 'descripcion' => ''];
    $descuento25kg = ['oferta' => false, 'oferta_precio_2' => null, 'descripcion' => ''];
    
    // Verificar si col15kg o col25kg tienen formato "XKG $ 4500" (ya procesado, no es descuento adicional)
    $col15kgEsXKG = !empty($col15kg) && preg_match('/X\s*KG\s*\$?\s*(\d+(?:[.,]\d+)?)/i', $col15kg);
    $col25kgEsXKG = !empty($col25kg) && preg_match('/X\s*KG\s*\$?\s*(\d+(?:[.,]\d+)?)/i', $col25kg);
    
    // Usar precio2 si existe, sino usar precio1 como referencia
    $precioBase = $precio2 !== null ? $precio2 : $precio1;
    
    // Detectar descuentos (algunos no necesitan precio base, como "X UNID" o "o mas")
    // Siempre intentar detectar descuentos, incluso sin precio base
    if (!$col15kgEsXKG) {
        $descuento15kg = detectDiscountInText($col15kg, $precioBase);
    }
    if (!$col25kgEsXKG) {
        $descuento25kg = detectDiscountInText($col25kg, $precioBase);
    }
    
    // Usar el descuento de 15KG si existe, sino el de 25KG
    $oferta = $descuento15kg['oferta'] || $descuento25kg['oferta'];
    $ofertaPrecio2 = $descuento15kg['oferta_precio_2'] ?? $descuento25kg['oferta_precio_2'];
    $descripcion = $descuento15kg['descripcion'] ?: $descuento25kg['descripcion'];
    
    // Si no hay descuento pero hay precio en col15kg que es menor que el precio base, es oferta
    // (solo si no es formato "XKG $")
    if (!$oferta && !$col15kgEsXKG && !empty($col15kg) && preg_match('/^\d+([.,]\d+)?$/', $col15kg)) {
        $precio15kg = normalizePrice($col15kg);
        if ($precio15kg !== null && $precio15kg > 100 && $precioBase !== null && $precio15kg < $precioBase) {
            $oferta = true;
            $ofertaPrecio2 = $precio15kg;
            $descripcion = 'Comprando 15KG, el kilo sale $' . number_format($precio15kg, 0, ',', '.') . ' en lugar de $' . number_format($precioBase, 0, ',', '.');
        }
    }
    
    // Limpiar nombre del producto (normalizar espacios y eliminar tabs)
    $nombre = preg_replace('/[\t]+/', ' ', $nombre); // Reemplazar tabs por espacios
    $nombre = preg_replace('/\s+/', ' ', $nombre); // Normalizar espacios múltiples
    // Eliminar cualquier tab o espacio al final (limpieza adicional - hacerlo varias veces)
    $nombre = preg_replace('/[\t\s]+$/', '', $nombre); // Eliminar tabs y espacios al final
    $nombre = rtrim($nombre, "\t "); // Limpiar cualquier tab o espacio restante
    $nombre = trim($nombre); // Limpieza final
    // Limpieza adicional para asegurar que no queden tabs
    $nombre = str_replace("\t", " ", $nombre);
    $nombre = preg_replace('/\s+/', ' ', $nombre);
    $nombre = trim($nombre);
    
    // Crear producto
    $producto = [
        'id' => generate_id(),
        'categoria' => $currentCategory,
        'nombre' => $nombre,
        'descripcion' => $descripcion,
        'precio_1' => $precio1,
        'precio_2' => $precio2,
        'oferta' => $oferta,
        'oferta_precio_1' => null,
        'oferta_precio_2' => $ofertaPrecio2,
        'imagen' => 'images/productos/placeholder.png'
    ];
    
    $productos[] = $producto;
}

// Guardar productos usando la función de config.php
if (!write_products($productos)) {
    die("❌ Error: No se pudieron guardar los productos. Revisá permisos de /data.\n");
}

// Guardar categorías usando la función de config.php
write_categories($categories);

// Salida HTML
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Importación Completada</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #28a745;
            margin-bottom: 20px;
        }
        .success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .info {
            background: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .btn {
            display: inline-block;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 20px;
        }
        .btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>✅ Importación Completada Exitosamente</h1>
        <div class="success">
            <strong>¡Todos los productos han sido importados correctamente!</strong>
        </div>
        <div class="info">
            <strong>📦 Total de productos:</strong> <?= count($productos) ?><br>
            <strong>📁 Total de categorías:</strong> <?= count($categories) ?><br>
            <strong>💾 Archivo guardado en:</strong> data/productos.json
        </div>
        <div class="info" style="margin-top: 20px;">
            <strong>📋 Categorías detectadas:</strong><br>
            <ul style="columns: 2; margin-top: 10px;">
                <?php foreach ($categories as $cat): ?>
                    <li><?= htmlspecialchars($cat) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
        <div class="info" style="margin-top: 20px;">
            <strong>📊 Productos por categoría:</strong><br>
            <ul style="columns: 2; margin-top: 10px;">
                <?php 
                $productosPorCategoria = [];
                foreach ($productos as $p) {
                    $cat = $p['categoria'] ?? 'SIN CATEGORÍA';
                    $productosPorCategoria[$cat] = ($productosPorCategoria[$cat] ?? 0) + 1;
                }
                foreach ($productosPorCategoria as $cat => $count): 
                ?>
                    <li><strong><?= htmlspecialchars($cat) ?>:</strong> <?= $count ?> productos</li>
                <?php endforeach; ?>
            </ul>
        </div>
        <a href="panel.php" class="btn">Volver al Panel</a>
    </div>
</body>
</html>
<?php
