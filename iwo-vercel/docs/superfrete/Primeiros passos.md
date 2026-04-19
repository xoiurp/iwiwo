Cotação de frete

# Cotação de frete

## Objetivo

Este endpoint tem como objetivo calcular o valor do frete para uma determinada encomenda, com base no CEP de origem, CEP de destino e nas características dos produtos ou pacotes a serem enviados.

***

## Campos da Requisição

Os campos abaixo devem ser enviados no corpo da requisição (geralmente em formato JSON):

### **Campos obrigatórios**

* `from` (string)\
  CEP de origem da encomenda. Aceita os formatos XXXXX-XXX ou XXXXXXXX.
* `to` (string)\
  CEP de destino da encomenda. Aceita os formatos XXXXX-XXX ou XXXXXXXX.
* `services` (string)\
  Lista com os códigos dos serviços de entrega que você deseja usar no cálculo:\
  ` 1`: PAC\
  ` 2`: Sedex\
  ` 17`: Mini Envios\
  `3`: Jadlog.Package\
  ` 31`: Loggi Econômico\
  Exemplos:\
  Para solicitar apenas Sedex: `2`\
  Para solicitar PAC e Sedex:` 1,2`
* `options` (objeto)\
  Objeto que representa as opções adicionais do cálculo do frete.\
  `own_hand` (booleano, opcional)\
  Indica se o serviço de Mão Própria deve ser considerado. Envie true para habilitar.\
  ` receipt` (booleano, opcional)\
  Indica se o serviço de Aviso de Recebimento deve ser considerado. Envie true para habilitar.\
  ` insurance_value` (float, opcional)\
  Valor declarado da encomenda utilizado para cálculo do seguro.\
  ` use_insurance_value` (booleano, opcional)\
  Indica se o cálculo deve incluir o seguro, usando o valor informado em insurance\_value.\
  Envie true para habilitar quando um valor declarado for fornecido.

### **Informações do pacote**

Você deve fornecer as informações sobre os itens a serem enviados de uma das duas maneiras abaixo:

1. **Envio das dimensões da caixa (quando já conhecidas):**

* `package` (objeto): Objeto contendo as dimensões da caixa:

`weight` (float): Peso total da caixa em quilogramas (kg)\
`height` (float): Altura da caixa em centímetros (cm)\
`width` (float): Largura da caixa em centímetros (cm)\
`length` (float): Comprimento da caixa em centímetros (cm)

2. **Envio das dimensões dos produtos individuais:**

* `products` (array de objetos): Array contendo informações de cada produto individual:

`quantity` (integer): Quantidade deste produto (padrão: 1)\
`weight` (float): Peso do produto em quilogramas (kg)\
`height` (float): Altura do produto em centímetros (cm)\
`width` (float): Largura do produto em centímetros (cm)\
`length` (float): Comprimento do produto em centímetros (cm)

<br />

> 📘 Importante: caixa ideal a partir de produtos
>
> Ao enviar as dimensões dos produtos individuais (products), a API SuperFrete calcula e retorna automaticamente as dimensões da caixa ideal para acomodar todos os itens.
>
> É essencial utilizar essas dimensões retornadas no cálculo do frete quando você for enviar os detalhes da etiqueta através da API de Envio de Frete.\
> Isso garante precisão no processo de envio e evita divergências com a transportadora.
>
> Exemplo
>
> Calculei o frete para 2 produtos com as dimensões abaixo:
>
> Produto 1
>
> ```
> Peso: 2
>
> Altura: 2
>
> Largura: 16
>
> Comprimento: 20
> ```
>
> Produto 2
>
> ```
> Peso: 2
>
> Altura: 2
>
> Largura: 16
>
> Comprimento: 20
> ```
>
> A caixa ideal retornada pela API no cálculo foi:
>
> ```
> Peso: 4
>
> Altura: 6
>
> Largura: 16
>
> Comprimento: 24
> ```
>
> Se eu criar um novo frete com esse cálculo e esses produtos, devo enviar para a SuperFrete, na API de Envio de Frete, as dimensões da caixa ideal, e não as dimensões dos produtos individuais.

***

Exemplo de requisição:

```Text Products
{
   "from":{
      "postal_code":"01153000"
   },
   "to":{
      "postal_code":"20020050"
   },
   "services":"1,2,17",
   "options":{
      "own_hand":false,
      "receipt":false,
      "insurance_value":0,
      "use_insurance_value":false
   },
   "products":[
      {
         "quantity":1,
         "height":4,
         "length":3,
         "width":3,
         "weight": 0.03
        
      }
   ]
   }
```
```Text Package
{
  "from": {
    "postal_code": "01153000"
  },
  "to": {
    "postal_code": "20020050"
  },
  "services": "1,2,17",
  "options": {
    "own_hand": false,
    "receipt": false,
    "insurance_value": 0,
    "use_insurance_value": false
  },
  "package": {
    "height": 99,
    "width": 50,
    "length": 12,
    "weight": 3
  }
}
```

***

## Loggi

Para que a Loggi apareça no cálculo, é necessário que exista um ponto de postagem da Loggi próximo ao CEP de origem.

**Importante**\
Não é mais necessário enviar o código 31 no campo services para calcular Loggi.\
A ativação ou desativação da Loggi é controlada diretamente nas configurações do token utilizado na requisição.

![](https://files.readme.io/e05b9411609de105f2e1a0be590e4d9b4c9a797bc7dfb8db256afbe40dc4fc0c-image.png)

#### Como desativar Loggi:

1. Acesse: <https://web.superfrete.com/#/integrations>
2. Clique em Configurações do token (o simbolo de engrenagem)
3. Selecione o botão para **desativar Loggi**
4. Clique em Salvar.

#### Dimensões máximas permitidas:

* 100 x 100 x 100 cm
* A soma dos lados não pode ultrapassar 200 cm
* Peso máximo: 30 kg

Seguro máximo permitido: R$ 3.000,00

***

## Jadlog

Para que a Jadlog apareça no cálculo, é necessário que exista um ponto de postagem da Jadlog próximo ao CEP de origem.

#### Dimensões máximas permitidas:

**Ponto de postagem – Franquias**\
(são unidades oficiais da própria Jadlog, pontos exclusivos da transportadora)

* Medidas máximas: 80 cm x 80 cm x 80 cm
* Peso máximo: 120 kg

**Ponto de postagem – Lojas Parceiras**\
(lojas comerciais que se disponibilizam para receber pacotes da Jadlog)

* Medidas máximas: 60 cm x 60 cm x 60 cm
* Peso máximo: 30 kg

Seguro máximo permitido: R$ 1.500,00

***

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
    "/api/v0/calculator": {
      "post": {
        "summary": "Cotação de frete",
        "description": "",
        "operationId": "cotacao-de-frete",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "from",
                  "to",
                  "services"
                ],
                "properties": {
                  "from": {
                    "type": "object",
                    "description": "Origem",
                    "required": [
                      "postal_code"
                    ],
                    "properties": {
                      "postal_code": {
                        "type": "string",
                        "description": "Código postal brasileiro (CEP)",
                        "default": "01153000"
                      }
                    }
                  },
                  "to": {
                    "type": "object",
                    "description": "Destino",
                    "required": [
                      "postal_code"
                    ],
                    "properties": {
                      "postal_code": {
                        "type": "string",
                        "description": "Código postal brasileiro (CEP)",
                        "default": "20020050"
                      }
                    }
                  },
                  "services": {
                    "type": "string",
                    "description": "Serviços que serão calculados. 1: PAC, 2: SEDEX, 17: Mini Envios, 3: Jadlog, 31: Loggi",
                    "default": "1,2,17"
                  },
                  "options": {
                    "type": "object",
                    "description": "Serviços adicionais",
                    "properties": {
                      "own_hand": {
                        "type": "boolean",
                        "description": "Mão própria",
                        "default": false
                      },
                      "receipt": {
                        "type": "boolean",
                        "description": "Confirmação de recebimento",
                        "default": false
                      },
                      "insurance_value": {
                        "type": "number",
                        "description": "Valor a ser assegurado",
                        "default": 0,
                        "format": "float"
                      },
                      "use_insurance_value": {
                        "type": "boolean",
                        "description": "Usar valor assegurado",
                        "default": false
                      }
                    }
                  },
                  "package": {
                    "type": "object",
                    "description": "Pacote para a cotação de frete (Se usado será majoritário à lista de produtos na cotação do frete)",
                    "required": [
                      "height",
                      "width",
                      "length",
                      "weight"
                    ],
                    "properties": {
                      "height": {
                        "type": "number",
                        "description": "Altura",
                        "default": 2,
                        "format": "float"
                      },
                      "width": {
                        "type": "number",
                        "description": "Largura",
                        "default": 11,
                        "format": "float"
                      },
                      "length": {
                        "type": "number",
                        "description": "Comprimento",
                        "default": 16,
                        "format": "float"
                      },
                      "weight": {
                        "type": "number",
                        "description": "Peso",
                        "default": 0.3,
                        "format": "float"
                      }
                    }
                  },
                  "products": {
                    "type": "array",
                    "description": "Listagem dos produtos contidos no pacote",
                    "items": {
                      "properties": {
                        "quantity": {
                          "type": "integer",
                          "format": "int32"
                        },
                        "height": {
                          "type": "number",
                          "format": "float"
                        },
                        "width": {
                          "type": "number",
                          "format": "float"
                        },
                        "length": {
                          "type": "number",
                          "format": "float"
                        },
                        "weight": {
                          "type": "number",
                          "format": "float"
                        }
                      },
                      "required": [
                        "quantity",
                        "height",
                        "width",
                        "length",
                        "weight"
                      ],
                      "type": "object"
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
                    "value": "[\n    {\n        \"id\": 1,\n        \"name\": \"PAC\",\n        \"price\": 18.61,\n        \"discount\": \"5.59\",\n        \"currency\": \"R$\",\n        \"delivery_time\": 5,\n        \"delivery_range\": {\n            \"min\": 5,\n            \"max\": 5\n        },\n        \"packages\": [\n            {\n                \"price\": 18.61,\n                \"discount\": \"5.59\",\n                \"format\": \"box\",\n                \"dimensions\": {\n                    \"height\": \"1\",\n                    \"width\": \"10\",\n                    \"length\": \"15\"\n                },\n                \"weight\": \"0.003\",\n                \"insurance_value\": 0\n            }\n        ],\n        \"additional_services\": {\n            \"receipt\": false,\n            \"own_hand\": false\n        },\n        \"company\": {\n            \"id\": 1,\n            \"name\": \"Correios\",\n            \"picture\": \"https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png\"\n        },\n        \"has_error\": false\n    },\n    {\n        \"id\": 2,\n        \"name\": \"SEDEX\",\n        \"price\": 10.77,\n        \"discount\": \"13.43\",\n        \"currency\": \"R$\",\n        \"delivery_time\": 1,\n        \"delivery_range\": {\n            \"min\": 1,\n            \"max\": 1\n        },\n        \"packages\": [\n            {\n                \"price\": 10.77,\n                \"discount\": \"13.43\",\n                \"format\": \"box\",\n                \"dimensions\": {\n                    \"height\": \"1\",\n                    \"width\": \"10\",\n                    \"length\": \"15\"\n                },\n                \"weight\": \"0.003\",\n                \"insurance_value\": 0\n            }\n        ],\n        \"additional_services\": {\n            \"receipt\": false,\n            \"own_hand\": false\n        },\n        \"company\": {\n            \"id\": 1,\n            \"name\": \"Correios\",\n            \"picture\": \"https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png\"\n        },\n        \"has_error\": false\n    },\n    {\n        \"id\": 17,\n        \"name\": \"Mini Envios\",\n        \"price\": 13,\n        \"discount\": \"11.21\",\n        \"currency\": \"R$\",\n        \"delivery_time\": 8,\n        \"delivery_range\": {\n            \"min\": 8,\n            \"max\": 8\n        },\n        \"packages\": [\n            {\n                \"price\": 13,\n                \"discount\": \"11.21\",\n                \"format\": \"box\",\n                \"dimensions\": {\n                    \"height\": \"1\",\n                    \"width\": \"10\",\n                    \"length\": \"15\"\n                },\n                \"weight\": \"0.003\",\n                \"insurance_value\": 0\n            }\n        ],\n        \"additional_services\": {\n            \"receipt\": false,\n            \"own_hand\": false\n        },\n        \"company\": {\n            \"id\": 1,\n            \"name\": \"Correios\",\n            \"picture\": \"https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png\"\n        },\n        \"has_error\": false\n    },\n    {\n        \"id\": 3,\n        \"name\": \"JADLOG.PACKAGE\",\n        \"price\": 14.4,\n        \"discount\": \"7.2\",\n        \"currency\": \"R$\",\n        \"delivery_time\": 2,\n        \"delivery_range\": {\n            \"min\": 2,\n            \"max\": 2\n        },\n        \"packages\": [\n            {\n                \"price\": 14.4,\n                \"discount\": \"7.2\",\n                \"format\": \"package\",\n                \"dimensions\": {\n                    \"height\": \"1\",\n                    \"width\": \"8\",\n                    \"length\": \"14\"\n                },\n                \"weight\": \"0.1\",\n                \"insurance_value\": 100\n            }\n        ],\n        \"additional_services\": {\n            \"receipt\": false,\n            \"own_hand\": false\n        },\n        \"company\": {\n            \"id\": 2,\n            \"name\": \"jadlog\",\n            \"picture\": \"\"\n        },\n        \"has_error\": false\n    },\n    {\n        \"id\": 31,\n        \"name\": \"LOGGI Econômico\",\n        \"price\": 9.76,\n        \"discount\": \"4.88\",\n        \"currency\": \"R$\",\n        \"delivery_time\": 3,\n        \"delivery_range\": {\n            \"min\": 3,\n            \"max\": 3\n        },\n        \"packages\": [\n            {\n                \"price\": 9.76,\n                \"discount\": \"4.88\",\n                \"format\": \"package\",\n                \"dimensions\": {\n                    \"height\": \"1\",\n                    \"width\": \"8\",\n                    \"length\": \"14\"\n                },\n                \"weight\": \"0.1\",\n                \"insurance_value\": 100\n            }\n        ],\n        \"additional_services\": {\n            \"receipt\": false,\n            \"own_hand\": false\n        },\n        \"company\": {\n            \"id\": 14,\n            \"name\": \"loggi\",\n            \"picture\": \"\"\n        },\n        \"has_error\": false\n    }\n]"
                  }
                },
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "integer",
                        "example": 1,
                        "default": 0
                      },
                      "name": {
                        "type": "string",
                        "example": "PAC"
                      },
                      "price": {
                        "type": "number",
                        "example": 18.61,
                        "default": 0
                      },
                      "discount": {
                        "type": "string",
                        "example": "5.59"
                      },
                      "currency": {
                        "type": "string",
                        "example": "R$"
                      },
                      "delivery_time": {
                        "type": "integer",
                        "example": 5,
                        "default": 0
                      },
                      "delivery_range": {
                        "type": "object",
                        "properties": {
                          "min": {
                            "type": "integer",
                            "example": 5,
                            "default": 0
                          },
                          "max": {
                            "type": "integer",
                            "example": 5,
                            "default": 0
                          }
                        }
                      },
                      "packages": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "price": {
                              "type": "number",
                              "example": 18.61,
                              "default": 0
                            },
                            "discount": {
                              "type": "string",
                              "example": "5.59"
                            },
                            "format": {
                              "type": "string",
                              "example": "box"
                            },
                            "dimensions": {
                              "type": "object",
                              "properties": {
                                "height": {
                                  "type": "string",
                                  "example": "1"
                                },
                                "width": {
                                  "type": "string",
                                  "example": "10"
                                },
                                "length": {
                                  "type": "string",
                                  "example": "15"
                                }
                              }
                            },
                            "weight": {
                              "type": "string",
                              "example": "0.003"
                            },
                            "insurance_value": {
                              "type": "integer",
                              "example": 0,
                              "default": 0
                            }
                          }
                        }
                      },
                      "additional_services": {
                        "type": "object",
                        "properties": {
                          "receipt": {
                            "type": "boolean",
                            "example": false,
                            "default": true
                          },
                          "own_hand": {
                            "type": "boolean",
                            "example": false,
                            "default": true
                          }
                        }
                      },
                      "company": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "integer",
                            "example": 1,
                            "default": 0
                          },
                          "name": {
                            "type": "string",
                            "example": "Correios"
                          },
                          "picture": {
                            "type": "string",
                            "example": "https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png"
                          }
                        }
                      },
                      "has_error": {
                        "type": "boolean",
                        "example": false,
                        "default": true
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
  "_id": "63879ecb146a930035ba9f95:6387a00859cd100016c0928a"
}
```