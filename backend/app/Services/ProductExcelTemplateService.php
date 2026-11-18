<?php
declare(strict_types=1);

namespace App\Services;

use App\Helpers\Database;
use PDO;
use ZipArchive;
use RuntimeException;

/**
 * ProductExcelTemplateService
 * Genera de forma nativa (OpenXML / ZipArchive) la plantilla oficial de Excel (.xlsx)
 * con 3 hojas estructuradas, diseño corporativo de Tiendas Mass, autofiltros,
 * congelamiento de encabezados, formatos numéricos y listas de referencia dinámicas.
 */
class ProductExcelTemplateService {
    private PDO $db;

    public function __construct(?PDO $db = null) {
        $this->db = $db ?? Database::getConnection();
    }

    /**
     * Obtiene las categorías activas directamente de la base de datos.
     * @return array<int, array{id: int, nombre: string}>
     */
    public function getActiveCategories(): array {
        try {
            $stmt = $this->db->query("SELECT id, nombre FROM categorias WHERE estado = 1 ORDER BY id ASC");
            return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Exception $e) {
            return [
                ['id' => 1, 'nombre' => 'Abarrotes y Despensa'],
                ['id' => 2, 'nombre' => 'Lácteos y Huevos'],
                ['id' => 3, 'nombre' => 'Bebidas y Licores'],
                ['id' => 4, 'nombre' => 'Limpieza y Cuidado'],
                ['id' => 5, 'nombre' => 'Frutas y Verduras']
            ];
        }
    }

    /**
     * Resuelve y sanitiza la imagen indicada para un producto:
     * - Admite nombre de archivo (ej. aceite.jpg)
     * - Admite rutas relativas (assets/uploads/products/...)
     * - Admite URLs web seguras (https://...)
     * - Previene directory traversal (../)
     * - Aplica fallback corporativo o mantiene la existente
     */
    public static function resolveProductImage(?string $inputImage, ?string $fallback = null): string {
        $defaultFallback = 'assets/uploads/products/prod_ae8275a924fa23bc.png';
        $input = trim((string)$inputImage);

        // Si viene vacío o con el placeholder ilustrativo del Excel
        if ($input === '' || strtolower($input) === 'imagen_producto.jpg' || strtolower($input) === 'default.png') {
            return $fallback ?: $defaultFallback;
        }

        // Si es URL web completa
        if (filter_var($input, FILTER_VALIDATE_URL)) {
            return $input;
        }

        // Sanitización contra path traversal
        $cleanPath = str_replace(['..', '\\'], ['', '/'], $input);
        $cleanPath = ltrim($cleanPath, '/');

        $baseFrontend = realpath(__DIR__ . '/../../../frontend') ?: (__DIR__ . '/../../../frontend');

        // 1. Si es ruta relativa dentro de frontend/
        $candidateFull = $baseFrontend . '/' . $cleanPath;
        if (file_exists($candidateFull) && is_file($candidateFull)) {
            return $cleanPath;
        }

        // 2. Si es solo nombre de archivo dentro de uploads/products/
        $filename = basename($cleanPath);
        $inUploads = $baseFrontend . '/assets/uploads/products/' . $filename;
        if (file_exists($inUploads) && is_file($inUploads)) {
            return 'assets/uploads/products/' . $filename;
        }

        // 3. Extensión de imagen permitida
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
            return 'assets/uploads/products/' . $filename;
        }

        return $fallback ?: $defaultFallback;
    }

    /**
     * Escapa caracteres especiales para compatibilidad estricta con OpenXML.
     */
    private static function xmlEscape(string $str): string {
        return htmlspecialchars($str, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    /**
     * Genera el elemento XML de una celda de texto.
     */
    private static function cellStr(string $col, int $row, string $val, int $style = 0): string {
        $ref = $col . $row;
        $escaped = self::xmlEscape($val);
        return "<c r=\"{$ref}\" t=\"inlineStr\" s=\"{$style}\"><is><t>{$escaped}</t></is></c>";
    }

    /**
     * Genera el elemento XML de una celda numérica con estilo específico.
     */
    private static function cellNum(string $col, int $row, float|int $val, int $style = 0): string {
        $ref = $col . $row;
        $clean = is_finite((float)$val) ? $val : 0;
        return "<c r=\"{$ref}\" s=\"{$style}\"><v>{$clean}</v></c>";
    }

    /**
     * Construye la Hoja 1: IMPORTACIÓN DE PRODUCTOS
     */
    private function buildSheet1Xml(array $categories): string {
        $rows = [];
        $r = 1;

        // Fila 1: Encabezados Oficiales
        $rows[] = "<row r=\"{$r}\" ht=\"30\" customHeight=\"1\">" .
            self::cellStr("A", $r, "FOTO", 1) .
            self::cellStr("B", $r, "SKU / BARRAS", 1) .
            self::cellStr("C", $r, "NOMBRE DEL PRODUCTO", 1) .
            self::cellStr("D", $r, "CATEGORÍA", 1) .
            self::cellStr("E", $r, "PRECIO DE VENTA", 1) .
            self::cellStr("F", $r, "COSTO BASE", 1) .
            self::cellStr("G", $r, "STOCK ACTUAL", 1) .
            self::cellStr("H", $r, "TIPO", 1) .
            "</row>";
        $r++;

        // Filas de Ejemplo Ilustrativo requeridas
        $sampleRows = [
            [
                'foto'        => 'imagen_producto.jpg',
                'sku'         => 'SKU-ACE-002',
                'nombre'      => 'Aceite Vegetal Primor Clásico 900 ml',
                'categoria'   => 'Abarrotes y Despensa',
                'precio'      => 8.90,
                'costo'       => 6.20,
                'stock'       => 54,
                'tipo'        => 'No Perecedero'
            ],
            [
                'foto'        => 'imagen_producto.jpg',
                'sku'         => 'SKU-ARR-001',
                'nombre'      => 'Arroz Costeño Extra 1 kg',
                'categoria'   => 'Abarrotes y Despensa',
                'precio'      => 4.50,
                'costo'       => 3.50,
                'stock'       => 90,
                'tipo'        => 'No Perecedero'
            ],
            [
                'foto'        => 'imagen_producto.jpg',
                'sku'         => 'SKU-MASS-016',
                'nombre'      => 'Arroz Extra Grano Largo Mass Bolsa 5 kg',
                'categoria'   => 'Abarrotes y Despensa',
                'precio'      => 22.90,
                'costo'       => 18.20,
                'stock'       => 35,
                'tipo'        => 'No Perecedero'
            ]
        ];

        foreach ($sampleRows as $idx => $sample) {
            $isZebra = ($idx % 2 === 1);
            $styleStr = $isZebra ? 3 : 2;
            $styleCenter = $isZebra ? 5 : 4;
            $stylePrice = $isZebra ? 7 : 6;
            $styleInt = $isZebra ? 9 : 8;

            $rows[] = "<row r=\"{$r}\" ht=\"22\">" .
                self::cellStr("A", $r, $sample['foto'], $styleCenter) .
                self::cellStr("B", $r, $sample['sku'], $styleCenter) .
                self::cellStr("C", $r, $sample['nombre'], $styleStr) .
                self::cellStr("D", $r, $sample['categoria'], $styleStr) .
                self::cellNum("E", $r, $sample['precio'], $stylePrice) .
                self::cellNum("F", $r, $sample['costo'], $stylePrice) .
                self::cellNum("G", $r, $sample['stock'], $styleInt) .
                self::cellStr("H", $r, $sample['tipo'], $styleCenter) .
                "</row>";
            $r++;
        }

        $catCount = max(2, count($categories) + 1);

        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>
    <col min="1" max="1" width="22" customWidth="1"/>
    <col min="2" max="2" width="20" customWidth="1"/>
    <col min="3" max="3" width="46" customWidth="1"/>
    <col min="4" max="4" width="28" customWidth="1"/>
    <col min="5" max="5" width="18" customWidth="1"/>
    <col min="6" max="6" width="18" customWidth="1"/>
    <col min="7" max="7" width="16" customWidth="1"/>
    <col min="8" max="8" width="20" customWidth="1"/>
  </cols>
  <sheetData>' . implode("\n", $rows) . '</sheetData>
  <autoFilter ref="A1:H4"/>
  <dataValidations count="2">
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="D2:D500">
      <formula1>\'LISTAS DE REFERENCIA\'!$A$2:$A$' . $catCount . '</formula1>
    </dataValidation>
    <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="H2:H500">
      <formula1>\'LISTAS DE REFERENCIA\'!$C$2:$C$3</formula1>
    </dataValidation>
  </dataValidations>
</worksheet>';
        return $xml;
    }

    /**
     * Construye la Hoja 2: INSTRUCCIONES
     */
    private function buildSheet2Xml(): string {
        $rows = [];
        $r = 1;

        // Título del Banner
        $rows[] = "<row r=\"{$r}\" ht=\"32\" customHeight=\"1\">" .
            self::cellStr("A", $r, "GUÍA OFICIAL DE IMPORTACIÓN MASIVA DE PRODUCTOS – TIENDAS MASS", 10) .
            self::cellStr("B", $r, "", 10) .
            self::cellStr("C", $r, "", 10) .
            self::cellStr("D", $r, "", 10) .
            "</row>";
        $r++;

        $rows[] = "<row r=\"{$r}\" ht=\"20\">" .
            self::cellStr("A", $r, "Esta plantilla permite registrar y actualizar masivamente productos del catálogo respetando inventarios por sucursal.", 11) .
            self::cellStr("B", $r, "", 11) .
            self::cellStr("C", $r, "", 11) .
            self::cellStr("D", $r, "", 11) .
            "</row>";
        $r += 2;

        // Encabezados de la Tabla de Instrucciones
        $rows[] = "<row r=\"{$r}\" ht=\"24\" customHeight=\"1\">" .
            self::cellStr("A", $r, "COLUMNA", 1) .
            self::cellStr("B", $r, "OBLIGATORIO", 1) .
            self::cellStr("C", $r, "FORMATO Y REGLAS DE VALIDACIÓN", 1) .
            self::cellStr("D", $r, "EJEMPLO ILUSTRATIVO", 1) .
            "</row>";
        $r++;

        $specs = [
            [
                'FOTO',
                'Opcional',
                'Nombre de archivo (ej. aceite.jpg), ruta relativa dentro de la carpeta del sistema (assets/uploads/products/...) o URL web directa (https://...). Si se deja vacío o "imagen_producto.jpg", el sistema asignará la imagen de catálogo por defecto. Para productos existentes, si se deja vacío se conserva la imagen actual.',
                'aceite_primor_900.jpg'
            ],
            [
                'SKU / BARRAS',
                'Obligatorio',
                'Código alfanumérico único por producto (sin espacios extraños). Si el SKU ya existe en la base de datos, el sistema actualizará sus datos e inventario para la sucursal seleccionada. No debe existir SKU duplicado dentro del mismo archivo Excel.',
                'SKU-ACE-002'
            ],
            [
                'NOMBRE DEL PRODUCTO',
                'Obligatorio',
                'Nombre comercial completo del artículo (máximo 150 caracteres). No debe estar vacío ni contener etiquetas HTML.',
                'Aceite Vegetal Primor Clásico 900 ml'
            ],
            [
                'CATEGORÍA',
                'Obligatorio',
                'Debe coincidir con una de las categorías activas registradas en la base de datos (ver hoja LISTAS DE REFERENCIA). Se dispone de lista desplegable automática en Excel.',
                'Abarrotes y Despensa'
            ],
            [
                'PRECIO DE VENTA',
                'Obligatorio',
                'Valor numérico decimal mayor a 0 (en Nuevos Soles S/.). Utilizar punto decimal. Ejemplo: 8.90.',
                '8.90'
            ],
            [
                'COSTO BASE',
                'Obligatorio',
                'Valor numérico decimal mayor a 0 que representa el costo unitario de adquisición. Ejemplo: 6.20.',
                '6.20'
            ],
            [
                'STOCK ACTUAL',
                'Obligatorio',
                'Número entero mayor o igual a 0 asignado a la sucursal seleccionada. Se registrará en inventarios y Kardex bajo método PEPS.',
                '54'
            ],
            [
                'TIPO',
                'Obligatorio',
                'Valores permitidos: "No Perecedero" o "Perecedero". Los productos perecederos ingresan al control PEPS/FIFO con fecha de expiración calculada.',
                'No Perecedero'
            ]
        ];

        foreach ($specs as $idx => $s) {
            $isZebra = ($idx % 2 === 1);
            $styleCol = $isZebra ? 5 : 4;
            $styleReq = $isZebra ? 5 : 4;
            $styleDesc = $isZebra ? 3 : 2;
            $styleEx = $isZebra ? 5 : 4;

            $rows[] = "<row r=\"{$r}\" ht=\"36\">" .
                self::cellStr("A", $r, $s[0], $styleCol) .
                self::cellStr("B", $r, $s[1], $styleReq) .
                self::cellStr("C", $r, $s[2], $styleDesc) .
                self::cellStr("D", $r, $s[3], $styleEx) .
                "</row>";
            $r++;
        }

        $r += 2;
        $rows[] = "<row r=\"{$r}\" ht=\"24\" customHeight=\"1\">" .
            self::cellStr("A", $r, "POLÍTICAS DE CONTROL POR SUCURSAL Y SEGURIDAD", 1) .
            self::cellStr("B", $r, "", 1) .
            self::cellStr("C", $r, "", 1) .
            self::cellStr("D", $r, "", 1) .
            "</row>";
        $r++;

        $policies = [
            "1. Permisos de Supervisor: Un usuario supervisor solo puede importar o actualizar existencias en su sucursal autorizada.",
            "2. Administrador General: Puede elegir la sucursal destino de la importación desde el panel administrativo.",
            "3. Vista Previa Obligatoria: Antes de impactar la base de datos, el sistema muestra una previsualización interactiva con el total de registros válidos, duplicados y con errores.",
            "4. Integridad Transaccional: El inventario se actualiza atómicamente con trazabilidad Kardex (PEPS/FIFO)."
        ];

        foreach ($policies as $pol) {
            $rows[] = "<row r=\"{$r}\" ht=\"20\">" .
                self::cellStr("A", $r, $pol, 2) .
                self::cellStr("B", $r, "", 2) .
                self::cellStr("C", $r, "", 2) .
                self::cellStr("D", $r, "", 2) .
                "</row>";
            $r++;
        }

        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>
    <col min="1" max="1" width="24" customWidth="1"/>
    <col min="2" max="2" width="18" customWidth="1"/>
    <col min="3" max="3" width="70" customWidth="1"/>
    <col min="4" max="4" width="28" customWidth="1"/>
  </cols>
  <sheetData>' . implode("\n", $rows) . '</sheetData>
</worksheet>';
        return $xml;
    }

    /**
     * Construye la Hoja 3: LISTAS DE REFERENCIA
     */
    private function buildSheet3Xml(array $categories): string {
        $rows = [];
        $r = 1;

        // Fila de Encabezados
        $rows[] = "<row r=\"{$r}\" ht=\"26\" customHeight=\"1\">" .
            self::cellStr("A", $r, "CATEGORÍAS ACTIVAS (SISTEMA)", 1) .
            self::cellStr("B", $r, "ID CATEGORÍA", 1) .
            self::cellStr("C", $r, "TIPOS DE PRODUCTO VÁLIDOS", 1) .
            "</row>";
        $r++;

        $types = ['No Perecedero', 'Perecedero'];
        $maxRows = max(count($categories), count($types));

        for ($i = 0; $i < $maxRows; $i++) {
            $catName = isset($categories[$i]) ? $categories[$i]['nombre'] : '';
            $catId = isset($categories[$i]) ? (int)$categories[$i]['id'] : 0;
            $tipoVal = isset($types[$i]) ? $types[$i] : '';

            $isZebra = ($i % 2 === 1);
            $styleCat = $isZebra ? 3 : 2;
            $styleId = $isZebra ? 5 : 4;
            $styleTipo = $isZebra ? 5 : 4;

            $rowCells = "";
            $rowCells .= self::cellStr("A", $r, $catName, $styleCat);
            if ($catId > 0) {
                $rowCells .= self::cellNum("B", $r, $catId, $styleId);
            } else {
                $rowCells .= self::cellStr("B", $r, "", $styleId);
            }
            $rowCells .= self::cellStr("C", $r, $tipoVal, $styleTipo);

            $rows[] = "<row r=\"{$r}\" ht=\"20\">" . $rowCells . "</row>";
            $r++;
        }

        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <cols>
    <col min="1" max="1" width="35" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="3" width="28" customWidth="1"/>
  </cols>
  <sheetData>' . implode("\n", $rows) . '</sheetData>
</worksheet>';
        return $xml;
    }

    /**
     * Construye el archivo de estilos OpenXML (styles.xml)
     */
    private static function getStylesXml(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="#,##0.00"/>
    <numFmt numFmtId="165" formatCode="#,##0"/>
  </numFmts>
  <fonts count="6">
    <font><name val="Segoe UI"/><sz val="10"/><color rgb="FF1E293B"/></font>
    <font><b/><name val="Segoe UI"/><sz val="11"/><color rgb="FFFFFFFF"/></font>
    <font><b/><name val="Segoe UI"/><sz val="10"/><color rgb="FF0F172A"/></font>
    <font><name val="Segoe UI"/><sz val="10"/><color rgb="FF334155"/></font>
    <font><b/><name val="Segoe UI"/><sz val="14"/><color rgb="FFFFFFFF"/></font>
    <font><i/><name val="Segoe UI"/><sz val="10"/><color rgb="FF64748B"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill> <!-- 2: Dark Header -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill> <!-- 3: White -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill> <!-- 4: Light Gray Zebra -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDCB02"/></patternFill></fill> <!-- 5: Tiendas Mass Yellow -->
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="12">
    <!-- 0: Default -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: Encabezado Tabla Principal (Dark + White Text + Center) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: Fila Blanca - Texto Normal -->
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <!-- 3: Fila Zebra Gris - Texto Normal -->
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <!-- 4: Fila Blanca - Centrado -->
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 5: Fila Zebra Gris - Centrado -->
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 6: Fila Blanca - Precio Decimal (0.00) -->
    <xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 7: Fila Zebra Gris - Precio Decimal (0.00) -->
    <xf numFmtId="164" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 8: Fila Blanca - Entero Stock (#,##0) -->
    <xf numFmtId="165" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 9: Fila Zebra Gris - Entero Stock (#,##0) -->
    <xf numFmtId="165" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <!-- 10: Banner Título (Mass Yellow o Dark) -->
    <xf numFmtId="0" fontId="4" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 11: Subtítulo Banner -->
    <xf numFmtId="0" fontId="5" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>';
    }

    private static function getWorkbookXml(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="IMPORTACIÓN DE PRODUCTOS" sheetId="1" r:id="rId1"/>
    <sheet name="INSTRUCCIONES" sheetId="2" r:id="rId2"/>
    <sheet name="LISTAS DE REFERENCIA" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>';
    }

    private static function getWorkbookRelsXml(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>';
    }

    private static function getRootRelsXml(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>';
    }

    private static function getContentTypesXml(): string {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>';
    }

    /**
     * Genera el archivo físico .xlsx en la ruta indicada o un archivo temporal.
     * @param string $outputPath Ruta de destino física (opcional).
     * @return string Ruta completa del archivo generado.
     */
    public function generateTemplate(string $outputPath = ''): string {
        $targetPath = $outputPath !== '' ? $outputPath : sys_get_temp_dir() . '/plantilla_productos_mass_' . uniqid() . '.xlsx';
        $categories = $this->getActiveCategories();

        $zip = new ZipArchive();
        if ($zip->open($targetPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException("No se pudo inicializar el archivo ZIP/XLSX en: {$targetPath}");
        }

        $zip->addFromString('_rels/.rels', self::getRootRelsXml());
        $zip->addFromString('[Content_Types].xml', self::getContentTypesXml());
        $zip->addFromString('xl/_rels/workbook.xml.rels', self::getWorkbookRelsXml());
        $zip->addFromString('xl/workbook.xml', self::getWorkbookXml());
        $zip->addFromString('xl/styles.xml', self::getStylesXml());
        $zip->addFromString('xl/worksheets/sheet1.xml', $this->buildSheet1Xml($categories));
        $zip->addFromString('xl/worksheets/sheet2.xml', $this->buildSheet2Xml());
        $zip->addFromString('xl/worksheets/sheet3.xml', $this->buildSheet3Xml($categories));

        $zip->close();
        return $targetPath;
    }

    /**
     * Guarda la plantilla en las carpetas DOC y docs oficiales del repositorio.
     * @param string $baseDir Directorio raíz del proyecto.
     * @return array<int, string>
     */
    public function saveOfficialTemplates(string $baseDir): array {
        $paths = [
            $baseDir . '/DOC/Plantilla_Oficial_Importacion_Productos_Mass.xlsx',
            $baseDir . '/docs/Plantilla_Oficial_Importacion_Productos_Mass.xlsx'
        ];

        $generated = [];
        foreach ($paths as $path) {
            $dir = dirname($path);
            if (!is_dir($dir)) {
                @mkdir($dir, 0777, true);
            }
            $this->generateTemplate($path);
            $generated[] = $path;
        }

        return $generated;
    }

    /**
     * Obtiene el contenido binario del archivo generado para streaming HTTP directo.
     */
    public function getBinaryContent(): string {
        $tmp = $this->generateTemplate();
        $content = file_get_contents($tmp);
        @unlink($tmp);
        return $content ?: '';
    }
}
