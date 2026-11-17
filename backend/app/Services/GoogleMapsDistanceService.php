<?php
namespace App\Services;

class GoogleMapsDistanceService {
    private string $apiKey;

    public function __construct() {
        $config = require __DIR__ . '/../../config/config.php';
        $this->apiKey = $config['google']['maps_api_key'] ?? '';
    }

    /**
     * Calcula la distancia, tiempo estimado y tarifa de delivery entre la sucursal y el cliente.
     * 
     * @param float $latOrigen
     * @param float $lonOrigen
     * @param float $latDestino
     * @param float $lonDestino
     * @param float $radioMaximoKm
     * @param float $costoBase
     * @param float $costoKmAdicional
     * @return array [
     *    'en_cobertura' => bool,
     *    'distancia_km' => float,
     *    'tiempo_min'   => int,
     *    'costo_envio'  => float,
     *    'metodo'       => 'GOOGLE_API' | 'HAVERSINE_ESTIMATED'
     * ]
     */
    public function calculateDeliveryMetrics(
        float $latOrigen,
        float $lonOrigen,
        float $latDestino,
        float $lonDestino,
        float $radioMaximoKm = 5.0,
        float $costoBase = 4.00,
        float $costoKmAdicional = 1.50
    ): array {
        $distanceKm = null;
        $durationMin = null;
        $metodo = 'HAVERSINE_ESTIMATED';

        // 1. Intentar consulta a Google Distance Matrix API si la API Key está configurada
        if (!empty($this->apiKey)) {
            $apiResult = $this->queryGoogleDistanceMatrix($latOrigen, $lonOrigen, $latDestino, $lonDestino);
            if ($apiResult !== null) {
                $distanceKm = $apiResult['distancia_km'];
                $durationMin = $apiResult['duracion_min'];
                $metodo = 'GOOGLE_API';
            }
        }

        // 2. Si no hay API Key o falló la conexión remota, recurrir a la fórmula de Haversine con factor vial
        if ($distanceKm === null) {
            $haversine = $this->calculateHaversineDistance($latOrigen, $lonOrigen, $latDestino, $lonDestino);
            // Factor de corrección vial urbana para Huancayo / Perú: la distancia real en calles es aprox. 1.25x la línea recta
            $distanceKm = round($haversine * 1.25, 2);
            // Estimación de tiempo: velocidad promedio de moto en ciudad ~ 20 km/h + 5 min de preparación
            $durationMin = (int)ceil(($distanceKm / 20) * 60) + 10;
        }

        // 3. Validar radio de cobertura
        $enCobertura = ($distanceKm <= $radioMaximoKm);

        // 4. Calcular tarifa de envío
        // Costo base hasta 1 km; luego costo por km adicional
        $kmExtra = max(0.0, $distanceKm - 1.0);
        $costoEnvio = round($costoBase + ($kmExtra * $costoKmAdicional), 2);

        return [
            'en_cobertura'        => $enCobertura,
            'distancia_km'        => $distanceKm,
            'tiempo_estimado_min' => $durationMin,
            'costo_envio'         => $costoEnvio,
            'radio_maximo_km'     => $radioMaximoKm,
            'metodo_calculo'      => $metodo
        ];
    }

    /**
     * Consulta la API oficial de Google Distance Matrix
     */
    private function queryGoogleDistanceMatrix(float $lat1, float $lon1, float $lat2, float $lon2): ?array {
        $url = sprintf(
            'https://maps.googleapis.com/maps/api/distancematrix/json?origins=%f,%f&destinations=%f,%f&mode=driving&key=%s',
            $lat1, $lon1, $lat2, $lon2, urlencode($this->apiKey)
        );

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $response) {
            $json = json_decode($response, true);
            if (isset($json['rows'][0]['elements'][0]['status']) && $json['rows'][0]['elements'][0]['status'] === 'OK') {
                $element = $json['rows'][0]['elements'][0];
                return [
                    'distancia_km' => round($element['distance']['value'] / 1000.0, 2),
                    'duracion_min' => (int)ceil($element['duration']['value'] / 60.0)
                ];
            }
        }

        return null;
    }

    /**
     * Fórmula de Haversine para cálculo geodésico de gran círculo en km
     */
    public function calculateHaversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): float {
        $earthRadius = 6371.0; // Radio de la Tierra en km

        $latDelta = deg2rad($lat2 - $lat1);
        $lonDelta = deg2rad($lon2 - $lon1);

        $a = sin($latDelta / 2) * sin($latDelta / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($lonDelta / 2) * sin($lonDelta / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }
}
