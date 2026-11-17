<?php
namespace App\Controllers;

use App\Repositories\BannerRepository;
use App\Helpers\Response;

class BannerController
{
    private BannerRepository $bannerRepo;

    public function __construct()
    {
        $this->bannerRepo = new BannerRepository();
    }

    /**
     * GET /api/banners
     * Retorna banners activos para el cliente (globales + sucursal opcional)
     */
    public function index(): void
    {
        $sucursalId = isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id']) 
            ? (int)$_GET['sucursal_id'] 
            : null;

        $banners = $this->bannerRepo->getActiveBanners($sucursalId);
        Response::json(['status' => 'success', 'data' => $banners]);
    }

    /**
     * GET /api/banners/admin
     * Retorna todos los banners para el panel administrativo, con permisos de rol
     */
    public function adminList(): void
    {
        $user = $GLOBALS['auth_user'] ?? null;
        $sucursalId = null;

        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            $sucursalId = (int)$user['sucursal_id'];
        } elseif (isset($_GET['sucursal_id']) && is_numeric($_GET['sucursal_id'])) {
            $sucursalId = (int)$_GET['sucursal_id'];
        }

        $banners = $this->bannerRepo->getAllForAdmin($sucursalId);
        Response::json(['status' => 'success', 'data' => $banners]);
    }

    /**
     * POST /api/banners
     * Crear un nuevo banner con validaciones de reglas de negocio y rol
     */
    public function store(): void
    {
        $user = $GLOBALS['auth_user'] ?? null;
        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($input['titulo']) || trim($input['titulo']) === '') {
            Response::json(['status' => 'error', 'message' => 'El título del banner es obligatorio.'], 400);
            return;
        }

        if (empty($input['imagen_url']) || trim($input['imagen_url']) === '') {
            Response::json(['status' => 'error', 'message' => 'La URL o ruta de la imagen del banner es obligatoria.'], 400);
            return;
        }

        // Restricción por rol de Supervisor
        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            $input['sucursal_id'] = (int)$user['sucursal_id'];
        }

        $id = $this->bannerRepo->create($input);
        Response::json([
            'status' => 'success',
            'message' => 'Banner publicitario creado correctamente.',
            'data' => ['id' => $id]
        ], 201);
    }

    /**
     * PUT /api/banners/{id}
     * Actualizar banner existente
     */
    public function update(string $id): void
    {
        $user = $GLOBALS['auth_user'] ?? null;
        $banner = $this->bannerRepo->findById((int)$id);

        if (!$banner) {
            Response::json(['status' => 'error', 'message' => 'Banner no encontrado.'], 404);
            return;
        }

        // Restricción de supervisor
        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            if ($banner['sucursal_id'] !== (int)$user['sucursal_id']) {
                Response::json(['status' => 'error', 'message' => 'No tiene permisos para modificar banners de otra sucursal o globales.'], 403);
                return;
            }
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($input['titulo']) || trim($input['titulo']) === '') {
            Response::json(['status' => 'error', 'message' => 'El título del banner es obligatorio.'], 400);
            return;
        }

        if (empty($input['imagen_url']) || trim($input['imagen_url']) === '') {
            Response::json(['status' => 'error', 'message' => 'La imagen del banner es obligatoria.'], 400);
            return;
        }

        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            $input['sucursal_id'] = (int)$user['sucursal_id'];
        }

        $this->bannerRepo->update((int)$id, $input);
        Response::json(['status' => 'success', 'message' => 'Banner actualizado con éxito.']);
    }

    /**
     * PATCH /api/banners/{id}/toggle
     */
    public function toggle(string $id): void
    {
        $user = $GLOBALS['auth_user'] ?? null;
        $banner = $this->bannerRepo->findById((int)$id);

        if (!$banner) {
            Response::json(['status' => 'error', 'message' => 'Banner no encontrado.'], 404);
            return;
        }

        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            if ($banner['sucursal_id'] !== (int)$user['sucursal_id']) {
                Response::json(['status' => 'error', 'message' => 'No autorizado para cambiar el estado de este banner.'], 403);
                return;
            }
        }

        $nuevoEstado = $banner['activo'] == 1 ? 0 : 1;
        $this->bannerRepo->toggleActivo((int)$id, $nuevoEstado);

        Response::json([
            'status' => 'success',
            'message' => $nuevoEstado ? 'Banner activado.' : 'Banner desactivado.',
            'activo' => $nuevoEstado
        ]);
    }

    /**
     * DELETE /api/banners/{id}
     */
    public function destroy(string $id): void
    {
        $user = $GLOBALS['auth_user'] ?? null;
        $banner = $this->bannerRepo->findById((int)$id);

        if (!$banner) {
            Response::json(['status' => 'error', 'message' => 'Banner no encontrado.'], 404);
            return;
        }

        if ($user && ($user['rol_nombre'] ?? '') === 'Supervisor') {
            if ($banner['sucursal_id'] !== (int)$user['sucursal_id']) {
                Response::json(['status' => 'error', 'message' => 'No autorizado para eliminar banners de otra sede.'], 403);
                return;
            }
        }

        $this->bannerRepo->delete((int)$id);
        Response::json(['status' => 'success', 'message' => 'Banner eliminado correctamente.']);
    }
}
