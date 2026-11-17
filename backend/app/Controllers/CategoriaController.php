<?php
namespace App\Controllers;

use App\Repositories\CategoriaRepository;
use App\Helpers\Response;

class CategoriaController {
    private CategoriaRepository $repo;

    public function __construct() {
        $this->repo = new CategoriaRepository();
    }

    public function index(): void {
        Response::success($this->repo->getAll());
    }
}
