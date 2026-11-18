<?php
namespace App\Routes;

use App\Helpers\Response;
use Closure;

class Router {
    private array $routes = [];
    private array $groupStack = [];

    public function get(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->addRoute('GET', $uri, $action, $middlewares);
    }

    public function getMapping(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->get($uri, $action, $middlewares);
    }

    public function post(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->addRoute('POST', $uri, $action, $middlewares);
    }

    public function postMapping(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->post($uri, $action, $middlewares);
    }

    public function put(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->addRoute('PUT', $uri, $action, $middlewares);
    }

    public function putMapping(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->put($uri, $action, $middlewares);
    }

    public function patch(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->addRoute('PATCH', $uri, $action, $middlewares);
    }

    public function patchMapping(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->patch($uri, $action, $middlewares);
    }

    public function delete(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->addRoute('DELETE', $uri, $action, $middlewares);
    }

    public function deleteMapping(string $uri, string|array|Closure $action, array $middlewares = []): void {
        $this->delete($uri, $action, $middlewares);
    }

    public function group(array $attributes, Closure $callback): void {
        $this->groupStack[] = $attributes;
        $callback($this);
        array_pop($this->groupStack);
    }

    private function addRoute(string $method, string $uri, string|array|Closure $action, array $middlewares = []): void {
        $prefix = '';
        $groupMiddlewares = [];

        foreach ($this->groupStack as $group) {
            if (isset($group['prefix'])) {
                $prefix .= '/' . trim($group['prefix'], '/');
            }
            if (isset($group['middleware'])) {
                $m = is_array($group['middleware']) ? $group['middleware'] : [$group['middleware']];
                $groupMiddlewares = array_merge($groupMiddlewares, $m);
            }
        }

        $fullUri = rtrim($prefix . '/' . trim($uri, '/'), '/');
        if ($fullUri === '') {
            $fullUri = '/';
        }

        $this->routes[] = [
            'method'      => $method,
            'uri'         => $fullUri,
            'action'      => $action,
            'middlewares' => array_merge($groupMiddlewares, $middlewares)
        ];
    }

    public function dispatch(string $requestMethod, string $requestUri): void {
        // Limpia query string y normaliza path
        $path = parse_url($requestUri, PHP_URL_PATH);
        
        // Normalizar path base en entornos XAMPP (subcarpetas y rewrites)
        $knownBases = [
            '/tiendasmass/backend/public',
            '/backend/public',
            '/tiendasmass'
        ];
        foreach ($knownBases as $kb) {
            if (strpos($path, $kb) === 0) {
                $path = substr($path, strlen($kb));
                break;
            }
        }

        $scriptName = dirname($_SERVER['SCRIPT_NAME'] ?? '');
        if ($scriptName !== '/' && $scriptName !== '\\' && strpos($path, $scriptName) === 0) {
            $path = substr($path, strlen($scriptName));
        }

        if (strpos($path, '/index.php') === 0) {
            $path = substr($path, strlen('/index.php'));
        }

        $path = '/' . trim($path, '/');
        if ($path === '//') {
            $path = '/';
        }

        foreach ($this->routes as $route) {
            if ($route['method'] !== $requestMethod) {
                continue;
            }

            // Convertir URI de ruta en patrón regex para {param}
            $pattern = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '(?P<$1>[^/]+)', $route['uri']);
            $pattern = "#^" . $pattern . "$#";

            if (preg_match($pattern, $path, $matches)) {
                // Ejecutar middlewares de la ruta
                foreach ($route['middlewares'] as $middleware) {
                    $this->executeMiddleware($middleware);
                }

                // Filtrar parámetros nombrados
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);

                // Ejecutar la acción
                $this->executeAction($route['action'], $params);
                return;
            }
        }

        Response::error("Ruta no encontrada [{$requestMethod} {$path}]", 404);
    }

    private function executeMiddleware(string $middleware): void {
        if ($middleware === 'jwt') {
            \App\Middleware\JwtAuthMiddleware::handle();
        } elseif (strpos($middleware, 'role:') === 0) {
            $rolesStr = substr($middleware, 5);
            $roles = explode(',', $rolesStr);
            \App\Middleware\RoleMiddleware::requireRole($roles);
        }
    }

    private function executeAction(string|array|Closure $action, array $params): void {
        if ($action instanceof Closure) {
            call_user_func_array($action, $params);
            return;
        }

        if (is_string($action) && strpos($action, '@') !== false) {
            list($controller, $method) = explode('@', $action);
            $controllerClass = "App\\Controllers\\" . $controller;

            if (!class_exists($controllerClass)) {
                Response::error("Controlador {$controllerClass} no encontrado", 500);
            }

            $instance = new $controllerClass();
            if (!method_exists($instance, $method)) {
                Response::error("Método {$method} no existe en {$controllerClass}", 500);
            }

            call_user_func_array([$instance, $method], $params);
            return;
        }

        Response::error("Acción de ruta inválida", 500);
    }
}
