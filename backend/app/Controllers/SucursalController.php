<?php
namespace App\Controllers;

use App\Repositories\SucursalRepository;
use App\Helpers\Response;
use App\Helpers\Validator;

class SucursalController {
    private SucursalRepository $repo;

    public function __construct() {
        $this->repo = new SucursalRepository();
    }

    public function index(): void {
        $sucursales = $this->repo->getAll(true);
        Response::success($sucursales);
    }

    public function show(string $id): void {
        $sucursal = $this->repo->getById((int)$id);
        if (!$sucursal) {
            Response::error('Sucursal no encontrada', 404);
        }
        Response::success($sucursal);
    }

    public function store(): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $validator = Validator::make($input, [
            'codigo_tienda' => 'required',
            'nombre'        => 'required',
            'direccion'     => 'required',
            'latitud'       => 'required|numeric',
            'longitud'      => 'required|numeric'
        ]);

        if ($validator->fails()) {
            Response::error('Datos de sucursal incompletos', 422, $validator->getErrors());
        }

        $id = $this->repo->create($input);
        Response::success(['id' => $id], 'Sucursal creada exitosamente', 201);
    }

    public function update(string $id): void {
        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $sucursal = $this->repo->getById((int)$id);
        if (!$sucursal) {
            Response::error('Sucursal no encontrada', 404);
        }

        $this->repo->update((int)$id, $input);
        Response::success(null, 'Sucursal actualizada exitosamente');
    }
}
