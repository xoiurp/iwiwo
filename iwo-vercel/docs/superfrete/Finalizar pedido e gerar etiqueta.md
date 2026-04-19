Finalizar pedido e gerar etiqueta

# Finalizar pedido e gerar etiqueta

## Objetivo

Este endpoint permite realizar o pagamento de uma etiqueta de frete previamente gerada, utilizando o saldo disponível na sua conta SuperFrete.

> 🚧 Pré-requisito:
>
> Para utilizar este endpoint, é necessário possuir **saldo suficiente** na sua carteira SuperFrete.

***

### Como adicionar saldo à carteira SuperFrete

O processo de recarga varia conforme o ambiente utilizado.

### Ambiente de Produção:

1. Acesse o painel da SuperFrete: <https://web.superfrete.com/#/calcular-correios>
2. No menu, vá até **Perfil** e selecione **Carteira**.
3. Clique em **Recarregue com Pix**.
4. Escolha o valor desejado para recarga.
5. Clique em **Recarregar com pix**.
6. Utilize o código Pix gerado para efetuar o pagamento através do seu banco.
7. Após a confirmação, o crédito será automaticamente adicionado ao saldo da sua conta SuperFrete.

### Ambiente de Sandbox (Testes):

1. Acesse o ambiente de Sandbox da SuperFrete: <https://sandbox.superfrete.com/#/>
2. No menu, vá até **Perfil** e selecione **Carteira**.
3. Clique em **Recarregue com Pix**.
4. Escolha o valor desejado para recarga.
5. Clique em **Recarregar com pix**.
6. Clique em **Copiar código PIX**.
7. Cole o código PIX copiado diretamente na **barra de endereço do navegador** e pressione **Enter**.
8. Esse procedimento simula o pagamento e adiciona crédito à carteira de testes.

> 📘 Observação:
>
> Etiquetas geradas no ambiente de Sandbox não têm validade para postagem real. A adição de saldo no Sandbox é apenas para fins de teste da integração.

***

### Utilização do Endpoint:

Para realizar o pagamento de uma etiqueta, você precisará do `id` da etiqueta gerada previamente pela API de Envio de Frete.\
Esse `id` deve ser enviado no corpo da requisição deste endpoint.

Quando a requisição for concluída com sucesso, considerando um id válido e saldo suficiente, o pagamento será processado e o status da etiqueta será atualizado para **released**, indicando que está pronta para postagem.

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
    "/api/v0/checkout": {
      "post": {
        "summary": "Finalizar pedido e gerar etiqueta",
        "description": "",
        "operationId": "apiintegrationv1checkout",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "orders"
                ],
                "properties": {
                  "orders": {
                    "type": "array",
                    "description": "ID do pedido retornado no endpoint de enviar frete para a SuperFrete.",
                    "items": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "200",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{\n   \"success\":true,\n   \"purchase\":{\n      \"status\":\"paid\",\n      \"orders\":[\n         {\n            \"id\":\"r8p3dhqjn4I0tBpnvkpU\",\n            \"price\": 33.33,\n            \"discount\": 1.11,\n            \"service_id\":2,\n            \"tracking\":\"DG048745602BR\",\n            \"print\": {\n              \"url\": \"\"\n            }\n         }\n      ]\n   }\n}"
                  }
                },
                "schema": {
                  "type": "object",
                  "properties": {
                    "success": {
                      "type": "boolean",
                      "example": true,
                      "default": true
                    },
                    "purchase": {
                      "type": "object",
                      "properties": {
                        "status": {
                          "type": "string",
                          "example": "paid"
                        },
                        "orders": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "example": "r8p3dhqjn4I0tBpnvkpU"
                              },
                              "price": {
                                "type": "number",
                                "example": 33.33,
                                "default": 0
                              },
                              "discount": {
                                "type": "number",
                                "example": 1.11,
                                "default": 0
                              },
                              "service_id": {
                                "type": "integer",
                                "example": 2,
                                "default": 0
                              },
                              "tracking": {
                                "type": "string",
                                "example": "DG048745602BR"
                              },
                              "print": {
                                "type": "object",
                                "properties": {
                                  "url": {
                                    "type": "string",
                                    "example": ""
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
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
  "_id": "63879ecb146a930035ba9f95:6388f15db29e3f0010d2c7c0"
}
```
