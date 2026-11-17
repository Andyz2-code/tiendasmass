<?php
namespace App\Controllers;

use App\Helpers\Response;
use Exception;

class UploadController {
    private string $uploadDir;

    public function __construct() {
        $this->uploadDir = realpath(__DIR__ . '/../../../frontend/assets') ?: (__DIR__ . '/../../../frontend/assets');
        $this->uploadDir .= '/uploads/products';
        if (!is_dir($this->uploadDir)) {
            @mkdir($this->uploadDir, 0777, true);
        }
    }

    /**
     * POST /api/upload/image
     * Carga de imagen con validación de tipo y peso (máx 5MB)
     */
    public function uploadImage(): void {
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
        $maxSizeBytes = 5 * 1024 * 1024; // 5 MB

        // 1. Caso Multipart/form-data
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

            // Verificar si es imagen real
            $imgInfo = @getimagesize($file['tmp_name']);
            if ($imgInfo === false) {
                Response::error('El archivo proporcionado no es una imagen válida.', 422);
            }

            $filename = 'prod_' . bin2hex(random_bytes(8)) . '.' . $ext;
            $destination = $this->uploadDir . '/' . $filename;

            if (!move_uploaded_file($file['tmp_name'], $destination)) {
                Response::error('No se pudo guardar la imagen en el servidor.', 500);
            }

            $relativePath = 'assets/uploads/products/' . $filename;
            Response::success(['url' => $relativePath, 'filename' => $filename], 'Imagen cargada correctamente.');
            return;
        }

        // 2. Caso Base64 en JSON
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        if (!empty($input['image_base64'])) {
            $base64 = $input['image_base64'];
            if (preg_match('/^data:image\/(\w+);base64,/', $base64, $type)) {
                $ext = strtolower($type[1]);
                if ($ext === 'jpeg') $ext = 'jpg';
                if (!in_array($ext, $allowedExtensions, true)) {
                    Response::error('Formato base64 no permitido. Solo JPG, PNG o WEBP.', 422);
                }
                $data = substr($base64, strpos($base64, ',') + 1);
                $decoded = base64_decode($data);
                if ($decoded === false) {
                    Response::error('Codificación base64 inválida.', 422);
                }
                if (strlen($decoded) > $maxSizeBytes) {
                    Response::error('La imagen supera el peso máximo de 5 MB.', 422);
                }

                $filename = 'prod_' . bin2hex(random_bytes(8)) . '.' . $ext;
                $destination = $this->uploadDir . '/' . $filename;
                file_put_contents($destination, $decoded);

                $relativePath = 'assets/uploads/products/' . $filename;
                Response::success(['url' => $relativePath, 'filename' => $filename], 'Imagen cargada correctamente.');
                return;
            }
        }

        Response::error('No se ha enviado ningún archivo o imagen base64 para cargar.', 400);
    }
}
