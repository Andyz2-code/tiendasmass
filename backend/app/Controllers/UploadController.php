<?php
namespace App\Controllers;

use App\Helpers\Response;
use Exception;
use DOMDocument;

class UploadController {
    private string $productUploadDir;
    private string $bannerUploadDir;

    public function __construct() {
        // Carpeta de productos
        $this->productUploadDir = realpath(__DIR__ . '/../../../frontend/assets') ?: (__DIR__ . '/../../../frontend/assets');
        $this->productUploadDir .= '/uploads/products';
        if (!is_dir($this->productUploadDir)) {
            @mkdir($this->productUploadDir, 0777, true);
        }

        // Carpeta de banners pública en backend/public/uploads/banners
        $this->bannerUploadDir = realpath(__DIR__ . '/../../public/uploads/banners') ?: (__DIR__ . '/../../public/uploads/banners');
        if (!is_dir($this->bannerUploadDir)) {
            @mkdir($this->bannerUploadDir, 0777, true);
        }
    }

    /**
     * Sanitizador de SVG seguro contra XSS y XXE
     */
    private function sanitizeSvg(string $svgContent): ?string {
        // Bloquear entidades XML externas peligrosas (XXE)
        if (preg_match('/<!ENTITY|SYSTEM/i', $svgContent)) {
            return null;
        }

        // Bloquear etiquetas ejecutables y scripts
        if (preg_match('/<script|javascript:|data:text\/html|on[a-z]+=/i', $svgContent)) {
            return null;
        }

        libxml_use_internal_errors(true);
        $dom = new DOMDocument();
        $dom->loadXML($svgContent, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();

        // Verificar que la raíz sea un elemento svg
        if ($dom->documentElement === null || strtolower($dom->documentElement->tagName) !== 'svg') {
            return null;
        }

        return $dom->saveXML();
    }

    /**
     * POST /api/upload/image (Productos)
     */
    public function uploadImage(): void {
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        $maxSizeBytes = 5 * 1024 * 1024; // 5 MB

        if (isset($_FILES['image']) && is_array($_FILES['image'])) {
            $file = $_FILES['image'];
            if ($file['error'] !== UPLOAD_ERR_OK) {
                Response::error("Error en la subida del archivo. Código: {$file['error']}", 400);
            }
            if ($file['size'] > $maxSizeBytes) {
                Response::error('La imagen supera el peso máximo permitido de 5 MB.', 422);
            }

            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExtensions, true)) {
                Response::error('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.', 422);
            }

            $imgInfo = @getimagesize($file['tmp_name']);
            if ($imgInfo === false) {
                Response::error('El archivo proporcionado no es una imagen válida.', 422);
            }

            $filename = 'prod_' . bin2hex(random_bytes(8)) . '.' . $ext;
            $destination = $this->productUploadDir . '/' . $filename;

            if (!move_uploaded_file($file['tmp_name'], $destination)) {
                Response::error('No se pudo guardar la imagen en el servidor.', 500);
            }

            $relativePath = 'assets/uploads/products/' . $filename;
            Response::success(['url' => $relativePath, 'filename' => $filename], 'Imagen cargada correctamente.');
            return;
        }

        // Base64
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!empty($input['image_base64'])) {
            $base64 = $input['image_base64'];
            if (preg_match('/^data:image\/(\w+);base64,/', $base64, $type)) {
                $ext = strtolower($type[1]);
                if ($ext === 'jpeg') $ext = 'jpg';
                if (!in_array($ext, $allowedExtensions, true)) {
                    Response::error('Formato base64 no permitido.', 422);
                }
                $data = substr($base64, strpos($base64, ',') + 1);
                $decoded = base64_decode($data);
                if ($decoded === false || strlen($decoded) > $maxSizeBytes) {
                    Response::error('Imagen base64 inválida o supera el peso máximo.', 422);
                }

                $filename = 'prod_' . bin2hex(random_bytes(8)) . '.' . $ext;
                $destination = $this->productUploadDir . '/' . $filename;
                file_put_contents($destination, $decoded);
                Response::success(['url' => 'assets/uploads/products/' . $filename, 'filename' => $filename], 'Imagen cargada.');
                return;
            }
        }

        Response::error('No se proporcionó ningún archivo de imagen válido.', 400);
    }

    /**
     * POST /api/upload/banner (Banners Promocionales - Prompt 2)
     * Soporta: JPG, JPEG, PNG, GIF, WebP, AVIF, SVG (sanitizado), BMP, TIFF
     */
    public function uploadBanner(): void {
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'tiff', 'tif'];
        $maxSizeBytes = 8 * 1024 * 1024; // 8 MB

        // 1. Manejo Multipart/form-data
        if (isset($_FILES['banner_image']) && is_array($_FILES['banner_image'])) {
            $file = $_FILES['banner_image'];

            if ($file['error'] !== UPLOAD_ERR_OK) {
                Response::error("Error al transferir el archivo (Código {$file['error']}).", 400);
            }

            if ($file['size'] > $maxSizeBytes) {
                Response::error('La imagen supera el peso máximo permitido para banners (8 MB).', 422);
            }

            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExtensions, true)) {
                Response::error('Formato no compatible. Se admiten JPG, PNG, GIF, WebP, AVIF, SVG, BMP y TIFF.', 422);
            }

            // Validar MIME real del archivo
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mimeType = finfo_file($finfo, $file['tmp_name']);
            finfo_close($finfo);

            $allowedMimes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'image/avif', 'image/svg+xml', 'image/bmp', 'image/x-ms-bmp',
                'image/tiff'
            ];

            if (!in_array($mimeType, $allowedMimes, true) && $ext !== 'svg') {
                Response::error("El contenido del archivo no corresponde a una imagen válida (MIME: {$mimeType}).", 422);
            }

            // Validación específica si es SVG
            if ($ext === 'svg' || $mimeType === 'image/svg+xml') {
                $rawSvg = file_get_contents($file['tmp_name']);
                $cleanSvg = $this->sanitizeSvg($rawSvg);
                if ($cleanSvg === null) {
                    Response::error('El archivo SVG contiene scripts o elementos potencialmente inseguros y fue rechazado por seguridad.', 422);
                }
            }

            $filename = 'banner_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            $destination = $this->bannerUploadDir . '/' . $filename;

            if ($ext === 'svg' && isset($cleanSvg)) {
                file_put_contents($destination, $cleanSvg);
            } else {
                if (!move_uploaded_file($file['tmp_name'], $destination)) {
                    Response::error('No se pudo guardar la imagen en el servidor de banners.', 500);
                }
            }

            $webUrl = 'http://localhost/tiendasmass/backend/public/uploads/banners/' . $filename;
            Response::success([
                'url'       => $webUrl,
                'filename'  => $filename,
                'mime_type' => $mimeType,
                'size_kb'   => round($file['size'] / 1024, 2)
            ], 'Imagen de banner cargada y validada correctamente.');
            return;
        }

        // 2. Manejo Base64 en JSON
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!empty($input['image_base64'])) {
            $base64 = $input['image_base64'];
            if (preg_match('/^data:image\/([\w\+\-]+);base64,/', $base64, $match)) {
                $rawType = strtolower($match[1]);
                $ext = 'jpg';
                if (strpos($rawType, 'png') !== false) $ext = 'png';
                elseif (strpos($rawType, 'webp') !== false) $ext = 'webp';
                elseif (strpos($rawType, 'gif') !== false) $ext = 'gif';
                elseif (strpos($rawType, 'svg') !== false) $ext = 'svg';
                elseif (strpos($rawType, 'avif') !== false) $ext = 'avif';
                elseif (strpos($rawType, 'bmp') !== false) $ext = 'bmp';

                $data = substr($base64, strpos($base64, ',') + 1);
                $decoded = base64_decode($data);
                if ($decoded === false || strlen($decoded) > $maxSizeBytes) {
                    Response::error('Imagen base64 inválida o excede los 8 MB.', 422);
                }

                if ($ext === 'svg') {
                    $decoded = $this->sanitizeSvg($decoded);
                    if ($decoded === null) {
                        Response::error('El archivo SVG contiene contenido no permitido.', 422);
                    }
                }

                $filename = 'banner_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                $destination = $this->bannerUploadDir . '/' . $filename;
                file_put_contents($destination, $decoded);

                $webUrl = 'http://localhost/tiendasmass/backend/public/uploads/banners/' . $filename;
                Response::success([
                    'url'      => $webUrl,
                    'filename' => $filename,
                    'format'   => strtoupper($ext)
                ], 'Imagen de banner procesada y almacenada con éxito.');
                return;
            }
        }

        Response::error('No se recibió ninguna imagen para el banner.', 400);
    }
}
