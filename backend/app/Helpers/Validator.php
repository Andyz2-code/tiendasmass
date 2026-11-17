<?php
namespace App\Helpers;

class Validator {
    private array $data;
    private array $rules;
    private array $errors = [];

    public function __construct(array $data, array $rules) {
        $this->data = $data;
        $this->rules = $rules;
    }

    public static function make(array $data, array $rules): self {
        $validator = new self($data, $rules);
        $validator->validate();
        return $validator;
    }

    public function fails(): bool {
        return !empty($this->errors);
    }

    public function getErrors(): array {
        return $this->errors;
    }

    private function validate(): void {
        foreach ($this->rules as $field => $ruleString) {
            $ruleList = explode('|', $ruleString);
            $value = $this->data[$field] ?? null;

            foreach ($ruleList as $rule) {
                $params = [];
                if (strpos($rule, ':') !== false) {
                    list($rule, $paramStr) = explode(':', $rule, 2);
                    $params = explode(',', $paramStr);
                }

                switch ($rule) {
                    case 'required':
                        if ($value === null || $value === '' || (is_array($value) && empty($value))) {
                            $this->addError($field, "El campo {$field} es obligatorio.");
                        }
                        break;

                    case 'numeric':
                        if ($value !== null && !is_numeric($value)) {
                            $this->addError($field, "El campo {$field} debe ser numérico.");
                        }
                        break;

                    case 'positive':
                        if ($value !== null && (!is_numeric($value) || $value <= 0)) {
                            $this->addError($field, "El campo {$field} debe ser un número positivo mayor a 0.");
                        }
                        break;

                    case 'non_negative':
                        if ($value !== null && (!is_numeric($value) || $value < 0)) {
                            $this->addError($field, "El campo {$field} no puede ser un número negativo.");
                        }
                        break;

                    case 'email':
                        if ($value !== null && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                            $this->addError($field, "El campo {$field} debe ser un correo electrónico válido.");
                        }
                        break;

                    case 'dni':
                        // Regla estricta DNI Perú: 8 dígitos numéricos exactos
                        if ($value !== null && !preg_match('/^\d{8}$/', (string)$value)) {
                            $this->addError($field, "El DNI debe contener exactamente 8 dígitos numéricos.");
                        }
                        break;

                    case 'pasaporte':
                        // Regla estricta Pasaporte: alfanumérico entre 6 y 12 caracteres
                        if ($value !== null && !preg_match('/^[A-Za-z0-9]{6,12}$/', (string)$value)) {
                            $this->addError($field, "El Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos.");
                        }
                        break;

                    case 'documento_cliente':
                        // Valida según el campo 'tipo_documento' en los datos
                        $tipo = $this->data['tipo_documento'] ?? '';
                        if ($tipo === 'DNI' && !preg_match('/^\d{8}$/', (string)$value)) {
                            $this->addError($field, "El DNI debe contener exactamente 8 dígitos numéricos.");
                        } elseif ($tipo === 'PASAPORTE' && !preg_match('/^[A-Za-z0-9]{6,12}$/', (string)$value)) {
                            $this->addError($field, "El Pasaporte debe tener entre 6 y 12 caracteres alfanuméricos.");
                        } elseif (!in_array($tipo, ['DNI', 'PASAPORTE'])) {
                            $this->addError($field, "El tipo de documento debe ser DNI o PASAPORTE únicamente.");
                        }
                        break;

                    case 'in':
                        if ($value !== null && !in_array($value, $params)) {
                            $this->addError($field, "El valor de {$field} no es válido. Debe ser uno de: " . implode(', ', $params));
                        }
                        break;

                    case 'min':
                        $min = (int)($params[0] ?? 0);
                        if (is_string($value) && mb_strlen($value) < $min) {
                            $this->addError($field, "El campo {$field} debe tener al menos {$min} caracteres.");
                        } elseif (is_numeric($value) && $value < $min) {
                            $this->addError($field, "El campo {$field} debe ser como mínimo {$min}.");
                        }
                        break;
                }
            }
        }
    }

    private function addError(string $field, string $message): void {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = [];
        }
        $this->errors[$field][] = $message;
    }
}
