Buscar informações do usuário

# Buscar informações do usuário

## Objetivo

Este endpoint retorna informações da sua conta na SuperFrete a partir do token de autenticação. São fornecidos dados como nome, sobrenome, telefone, e-mail, CPF, limites de uso, saldo e quantidade de etiquetas ativas.

**Os campos retornados incluem:**

`firstname`: primeiro nome do usuário

`lastname`: sobrenome do usuário

`phone`: telefone de contato

`email`: e-mail cadastrado

`document`: CPF do usuário

`limits`: limites de uso da conta

`shipments`: quantidade de etiquetas aguardando postagem

`shipments_available`: limite restante de etiquetas para aguardar postagem

`balance`: saldo total na conta

# OpenAPI definition

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Integration",
    "version": "0"
  },
  "servers": [
    {
      "url": "https://sandbox.superfrete.com"
    }
  ],
  "components": {
    "securitySchemes": {
      "sec0": {
        "type": "apiKey",
        "name": "Authorization",
        "in": "header",
        "x-bearer-format": "bearer",
        "x-default": ""
      }
    }
  },
  "security": [
    {
      "sec0": []
    }
  ],
  "paths": {
    "/api/v0/user": {
      "get": {
        "summary": "Buscar informações do usuário",
        "description": "",
        "operationId": "user-buscar-informações-do-usuário",
        "responses": {
          "200": {
            "description": "200",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{\n  \"id\": \"3kCKGqzlPFfCEj2X1Tkob07SN2M2\",\n  \"firstname\": \"Nome\",\n  \"lastname\": \"Sobrenome\",\n  \"phone\": \"+5511999999999\",\n  \"email\": \"mail@gmail.com\",\n  \"document\": \"00000000000\",\n  \"limits\": {\n    \"shipments\": 3,\n    \"shipments_available\": 2\n  },\n  \"balance\": 1763.04\n}"
                  }
                },
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "example": "3kCKGqzlPFfCEj2X1Tkob07SN2M2"
                    },
                    "firstname": {
                      "type": "string",
                      "example": "Nome"
                    },
                    "lastname": {
                      "type": "string",
                      "example": "Sobrenome"
                    },
                    "phone": {
                      "type": "string",
                      "example": "+5511999999999"
                    },
                    "email": {
                      "type": "string",
                      "example": "mail@gmail.com"
                    },
                    "document": {
                      "type": "string",
                      "example": "00000000000"
                    },
                    "limits": {
                      "type": "object",
                      "properties": {
                        "shipments": {
                          "type": "integer",
                          "example": 3,
                          "default": 0
                        },
                        "shipments_available": {
                          "type": "integer",
                          "example": 2,
                          "default": 0
                        }
                      }
                    },
                    "balance": {
                      "type": "number",
                      "example": 1763.04,
                      "default": 0
                    }
                  }
                }
              }
            }
          },
          "400": {
            "description": "400",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{}"
                  }
                },
                "schema": {
                  "type": "object",
                  "properties": {}
                }
              }
            }
          }
        },
        "deprecated": false
      }
    }
  },
  "x-readme": {
    "headers": [
      {
        "key": "User-Agent",
        "value": "Nome e versão da aplicação (email para contato técnico)"
      }
    ],
    "explorer-enabled": true,
    "proxy-enabled": true
  },
  "x-readme-fauxas": true,
  "_id": "63879ecb146a930035ba9f95:638a170766153a0048cee24f"
}
```