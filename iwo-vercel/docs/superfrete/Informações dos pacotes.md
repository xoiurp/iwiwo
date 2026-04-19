Informações dos pacotes

# Informações dos pacotes

## Informações dos serviços dos Correios

Esse endpoint (URL) retorna os detalhes técnicos de cada serviço dos Correios, incluindo limites de dimensões, peso, valores de seguro, requisitos obrigatórios e opcionais.

Explicação dos Campos Retornados\
A resposta vem organizada por código do serviço:

1 → PAC\
2 → SEDEX\
17 → Mini Envios

Cada serviço contém os seguintes grupos de informações:

* **name**\
  Nome comercial do serviço.\
  Ex.: `"PAC"`,` "SEDEX"`, `"MiniEnvios"`.
* **type**\
  Categoria do serviço segundo a classificação interna da API.\
  Exemplo: `"express"`.
* **range**\
  Abrangência do serviço.\
  Para todos os serviços Correios, o valor retornado é `"interstate"` (envios nacionais).
* **restrictions**\
  Limites definidos pelos Correios para cada serviço.

**insurance\_value**\
Valores mínimo e máximo permitidos para seguro:

```
     min: valor mínimo aceito

     max: valor máximo aceito
```

Exemplo (PAC e SEDEX):\
mínimo R$ 25,63, máximo R$ 38.057,59.

**formats > package**\
Informações sobre limites de embalagem quando usada uma caixa:

```
     weight (kg): peso mínimo e máximo permitido

     width (cm): largura mínima e máxima

     height (cm): altura mínima e máxima

     length (cm): comprimento mínimo e máximo

     sum: soma dos lados permitida (altura + largura + comprimento), máximo 200 cm
```

* **requirements**\
  Dados obrigatórios para envio:

`"names"` → Nome do remetente e destinatário

`"addresses"` → Endereço completo necessário

* **optionals**\
  Serviços adicionais que podem ser contratados:

AR → Aviso de Recebimento

MP → Mão Própria

VD → Valor Declarado

* **company**\
  Informações sobre a transportadora utilizada:

name: `"Correios"`

picture: link da logo exibida pela API

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
    "/api/v0/services/info": {
      "get": {
        "summary": "Informações dos pacotes",
        "description": "",
        "operationId": "informações-dos-pacotes",
        "responses": {
          "200": {
            "description": "200",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{\n\t\"1\": {\n\t\t\"name\": \"PAC\",\n\t\t\"type\": \"express\",\n\t\t\"range\": \"interstate\",\n\t\t\"restrictions\": {\n\t\t\t\"insurance_value\": {\n\t\t\t\t\"min\": 24.5,\n\t\t\t\t\"max\": 34000\n\t\t\t},\n\t\t\t\"formats\": {\n\t\t\t\t\"package\": {\n\t\t\t\t\t\"weight\": {\n\t\t\t\t\t\t\"min\": 0.3,\n\t\t\t\t\t\t\"max\": 30\n\t\t\t\t\t},\n\t\t\t\t\t\"width\": {\n\t\t\t\t\t\t\"min\": 16,\n\t\t\t\t\t\t\"max\": 150\n\t\t\t\t\t},\n\t\t\t\t\t\"height\": {\n\t\t\t\t\t\t\"min\": 4,\n\t\t\t\t\t\t\"max\": 150\n\t\t\t\t\t},\n\t\t\t\t\t\"length\": {\n\t\t\t\t\t\t\"min\": 24,\n\t\t\t\t\t\t\"max\": 150\n\t\t\t\t\t},\n\t\t\t\t\t\"sum\": 300\n\t\t\t\t}\n\t\t\t}\n\t\t},\n\t\t\"requirements\": [\n\t\t\t\"names\",\n\t\t\t\"addresses\"\n\t\t],\n\t\t\"optionals\": [\n\t\t\t\"AR\",\n\t\t\t\"MP\",\n\t\t\t\"VD\"\n\t\t],\n\t\t\"company\": {\n\t\t\t\"name\": \"Correios\",\n\t\t\t\"picture\": \"https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png\"\n\t\t}\n\t},\n\t\"2\": {\n\t\t\"name\": \"SEDEX\",\n\t\t\"type\": \"express\",\n\t\t\"range\": \"interstate\",\n\t\t\"restrictions\": {\n\t\t\t\"insurance_value\": {\n\t\t\t\t\"min\": 24.5,\n\t\t\t\t\"max\": 34000\n\t\t\t},\n\t\t\t\"formats\": {\n\t\t\t\t\"package\": {\n\t\t\t\t\t\"weight\": {\n\t\t\t\t\t\t\"min\": 0.3,\n\t\t\t\t\t\t\"max\": 30\n\t\t\t\t\t},\n\t\t\t\t\t\"width\": {\n\t\t\t\t\t\t\"min\": 16,\n\t\t\t\t\t\t\"max\": 150\n\t\t\t\t\t},\n\t\t\t\t\t\"height\": {\n\t\t\t\t\t\t\"min\": 4,\n\t\t\t\t\t\t\"max\": 150\n\t\t\t\t\t},\n\t\t\t\t\t\"length\": {\n\t\t\t\t\t\t\"min\": 24,\n\t\t\t\t\t\t\"max\": 150\n\t\t\t\t\t},\n\t\t\t\t\t\"sum\": 300\n\t\t\t\t}\n\t\t\t}\n\t\t},\n\t\t\"requirements\": [\n\t\t\t\"names\",\n\t\t\t\"addresses\"\n\t\t],\n\t\t\"optionals\": [\n\t\t\t\"AR\",\n\t\t\t\"MP\",\n\t\t\t\"VD\"\n\t\t],\n\t\t\"company\": {\n\t\t\t\"name\": \"Correios\",\n\t\t\t\"picture\": \"https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png\"\n\t\t}\n\t},\n\t\"17\": {\n\t\t\"name\": \"MiniEnvios\",\n\t\t\"type\": \"express\",\n\t\t\"range\": \"interstate\",\n\t\t\"restrictions\": {\n\t\t\t\"insurance_value\": {\n\t\t\t\t\"min\": 12.25,\n\t\t\t\t\"max\": 100\n\t\t\t},\n\t\t\t\"formats\": {\n\t\t\t\t\"package\": {\n\t\t\t\t\t\"weight\": {\n\t\t\t\t\t\t\"min\": 0.0001,\n\t\t\t\t\t\t\"max\": 0.3\n\t\t\t\t\t},\n\t\t\t\t\t\"width\": {\n\t\t\t\t\t\t\"min\": 10,\n\t\t\t\t\t\t\"max\": 16\n\t\t\t\t\t},\n\t\t\t\t\t\"height\": {\n\t\t\t\t\t\t\"min\": 1,\n\t\t\t\t\t\t\"max\": 4\n\t\t\t\t\t},\n\t\t\t\t\t\"length\": {\n\t\t\t\t\t\t\"min\": 15,\n\t\t\t\t\t\t\"max\": 24\n\t\t\t\t\t},\n\t\t\t\t\t\"sum\": 300\n\t\t\t\t}\n\t\t\t}\n\t\t},\n\t\t\"requirements\": [\n\t\t\t\"names\",\n\t\t\t\"addresses\"\n\t\t],\n\t\t\"optionals\": [\n\t\t\t\"AR\",\n\t\t\t\"MP\",\n\t\t\t\"VD\"\n\t\t],\n\t\t\"company\": {\n\t\t\t\"name\": \"Correios\",\n\t\t\t\"picture\": \"https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png\"\n\t\t}\n\t}\n}"
                  }
                },
                "schema": {
                  "type": "object",
                  "properties": {
                    "1": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string",
                          "example": "PAC"
                        },
                        "type": {
                          "type": "string",
                          "example": "express"
                        },
                        "range": {
                          "type": "string",
                          "example": "interstate"
                        },
                        "restrictions": {
                          "type": "object",
                          "properties": {
                            "insurance_value": {
                              "type": "object",
                              "properties": {
                                "min": {
                                  "type": "number",
                                  "example": 24.5,
                                  "default": 0
                                },
                                "max": {
                                  "type": "integer",
                                  "example": 34000,
                                  "default": 0
                                }
                              }
                            },
                            "formats": {
                              "type": "object",
                              "properties": {
                                "package": {
                                  "type": "object",
                                  "properties": {
                                    "weight": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "number",
                                          "example": 0.3,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 30,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "width": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 16,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 150,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "height": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 4,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 150,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "length": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 24,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 150,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "sum": {
                                      "type": "integer",
                                      "example": 300,
                                      "default": 0
                                    }
                                  }
                                }
                              }
                            }
                          }
                        },
                        "requirements": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "example": "names"
                          }
                        },
                        "optionals": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "example": "AR"
                          }
                        },
                        "company": {
                          "type": "object",
                          "properties": {
                            "name": {
                              "type": "string",
                              "example": "Correios"
                            },
                            "picture": {
                              "type": "string",
                              "example": "https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png"
                            }
                          }
                        }
                      }
                    },
                    "2": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string",
                          "example": "SEDEX"
                        },
                        "type": {
                          "type": "string",
                          "example": "express"
                        },
                        "range": {
                          "type": "string",
                          "example": "interstate"
                        },
                        "restrictions": {
                          "type": "object",
                          "properties": {
                            "insurance_value": {
                              "type": "object",
                              "properties": {
                                "min": {
                                  "type": "number",
                                  "example": 24.5,
                                  "default": 0
                                },
                                "max": {
                                  "type": "integer",
                                  "example": 34000,
                                  "default": 0
                                }
                              }
                            },
                            "formats": {
                              "type": "object",
                              "properties": {
                                "package": {
                                  "type": "object",
                                  "properties": {
                                    "weight": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "number",
                                          "example": 0.3,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 30,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "width": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 16,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 150,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "height": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 4,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 150,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "length": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 24,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 150,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "sum": {
                                      "type": "integer",
                                      "example": 300,
                                      "default": 0
                                    }
                                  }
                                }
                              }
                            }
                          }
                        },
                        "requirements": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "example": "names"
                          }
                        },
                        "optionals": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "example": "AR"
                          }
                        },
                        "company": {
                          "type": "object",
                          "properties": {
                            "name": {
                              "type": "string",
                              "example": "Correios"
                            },
                            "picture": {
                              "type": "string",
                              "example": "https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png"
                            }
                          }
                        }
                      }
                    },
                    "17": {
                      "type": "object",
                      "properties": {
                        "name": {
                          "type": "string",
                          "example": "MiniEnvios"
                        },
                        "type": {
                          "type": "string",
                          "example": "express"
                        },
                        "range": {
                          "type": "string",
                          "example": "interstate"
                        },
                        "restrictions": {
                          "type": "object",
                          "properties": {
                            "insurance_value": {
                              "type": "object",
                              "properties": {
                                "min": {
                                  "type": "number",
                                  "example": 12.25,
                                  "default": 0
                                },
                                "max": {
                                  "type": "integer",
                                  "example": 100,
                                  "default": 0
                                }
                              }
                            },
                            "formats": {
                              "type": "object",
                              "properties": {
                                "package": {
                                  "type": "object",
                                  "properties": {
                                    "weight": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "number",
                                          "example": 0.0001,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "number",
                                          "example": 0.3,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "width": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 10,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 16,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "height": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 1,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 4,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "length": {
                                      "type": "object",
                                      "properties": {
                                        "min": {
                                          "type": "integer",
                                          "example": 15,
                                          "default": 0
                                        },
                                        "max": {
                                          "type": "integer",
                                          "example": 24,
                                          "default": 0
                                        }
                                      }
                                    },
                                    "sum": {
                                      "type": "integer",
                                      "example": 300,
                                      "default": 0
                                    }
                                  }
                                }
                              }
                            }
                          }
                        },
                        "requirements": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "example": "names"
                          }
                        },
                        "optionals": {
                          "type": "array",
                          "items": {
                            "type": "string",
                            "example": "AR"
                          }
                        },
                        "company": {
                          "type": "object",
                          "properties": {
                            "name": {
                              "type": "string",
                              "example": "Correios"
                            },
                            "picture": {
                              "type": "string",
                              "example": "https://storage.googleapis.com/sandbox-api-superfrete.appspot.com/logos/correios.png"
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
  "_id": "63879ecb146a930035ba9f95:6544e4a85858be0f49521f8d"
}
```