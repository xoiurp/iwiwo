// ============================================
// Script de importação CSV → Vercel Postgres
// Migração Webflow → Vercel
// ============================================
//
// SETUP:
//   1. npm install @vercel/postgres csv-parse dotenv
//   2. Crie um arquivo .env.local com:
//      POSTGRES_URL=postgres://...  (copie do dashboard da Vercel)
//   3. Coloque o arquivo products.csv na mesma pasta
//   4. Execute: node import-products.mjs
//

import { sql } from '@vercel/postgres';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import 'dotenv/config';

// ---- Helpers ----

function parseBool(value) {
  if (!value || !value.trim()) return false;
  const v = value.trim().toLowerCase();
  return v === 'sim' || v === 'true';
}

function parsePrice(value) {
  if (!value || !value.trim()) return null;
  const cleaned = value.replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDate(value) {
  if (!value || !value.trim()) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

function trimOrNull(value) {
  if (!value || !value.trim()) return null;
  return value.trim();
}

// ---- Mapeamento CSV → Banco ----

function mapRow(row) {
  return {
    name: trimOrNull(row['Name']),
    slug: trimOrNull(row['Slug']),
    description: trimOrNull(row['Description']),
    descricao_longa: trimOrNull(row['Descrição Longa']),
    image: trimOrNull(row['Image']),
    product_type: trimOrNull(row['Product Type']),
    vendor: trimOrNull(row['Vendor']),
    collections: trimOrNull(row['Collections']),
    price: parsePrice(row['Price']),
    price_formatted: trimOrNull(row['Price Formatted']),
    compare_at_price: parsePrice(row['Compare at Price']),
    compare_at_price_formatted: trimOrNull(row['Compare at price Formatted']),
    seo_title: trimOrNull(row['SEO Title']),
    seo_description: trimOrNull(row['SEO Description']),
    webflow_collection_id: trimOrNull(row['Collection ID']),
    webflow_locale_id: trimOrNull(row['Locale ID']),
    webflow_item_id: trimOrNull(row['Item ID']),
    shopify_id: trimOrNull(row['Shopify ID']),
    shpid: trimOrNull(row['shpid']),
    archived: parseBool(row['Archived']),
    draft: parseBool(row['Draft']),
    is_gift_card: parseBool(row['Is gift Card?']),
    created_on: parseDate(row['Created On']),
    updated_on: parseDate(row['Updated On']),
    published_on: parseDate(row['Published On']),
    tamanho_da_caixa: trimOrNull(row['tamanho_da_caixa']),
    tipo_de_tela: trimOrNull(row['Tipo de Tela']),
    tamanho_display: trimOrNull(row['tamanho_display']),
    pedometro: parseBool(row['ped_metro']),
    monitoramento_de_sono: parseBool(row['monitoramento_de_sono']),
    saude_feminina: parseBool(row['sa_de_feminina']),
    ecg: parseBool(row['ecg']),
    pressao_arterial: parseBool(row['press_o_arterial']),
    frequencia_cardiaca: parseBool(row['frequ_ncia_card_aca']),
    oxigenio_no_sangue: parseBool(row['oxig_nio_no_sangue']),
    capacidade_da_bateria: trimOrNull(row['capacidade_da_bateria']),
    duracao_da_bateria: trimOrNull(row['dura_o_da_bateria']),
    acompanha_carregador: parseBool(row['acompanha_carregador']),
    bluetooth: trimOrNull(row['bluetooth']),
    com_gps: trimOrNull(row['com_gps']),
    com_wi_fi: parseBool(row['com_wi_fi']),
    rede_movel: parseBool(row['rede_m_vel']),
    com_nfc: trimOrNull(row['com_nfc']),
    memoria_interna: trimOrNull(row['mem_ria_interna']),
    musica_local: parseBool(row['m_sica_local']),
    leitor_de_ebooks: parseBool(row['leitor_de_e_books']),
    gravador_de_voz: parseBool(row['gravador_de_voz']),
    com_chat_gpt: parseBool(row['com_chat_gpt']),
    assistente_de_voz: parseBool(row['assistente_de_voz']),
    controle_de_musica: parseBool(row['controle_de_m_sica']),
    aplicativo: trimOrNull(row['aplicativo']),
    cor_1: trimOrNull(row['Cor 1']),
    cor_2: trimOrNull(row['Cor 2']),
    cor_3: trimOrNull(row['Cor 3']),
    url: trimOrNull(row['url']),
  };
}

// ---- Leitura do CSV ----

function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// ---- Inserção no banco ----

async function insertProduct(product) {
  const p = product;
  await sql`
    INSERT INTO products (
      name, slug, description, descricao_longa, image, product_type, vendor, collections,
      price, price_formatted, compare_at_price, compare_at_price_formatted,
      seo_title, seo_description,
      webflow_collection_id, webflow_locale_id, webflow_item_id, shopify_id, shpid,
      archived, draft, is_gift_card,
      created_on, updated_on, published_on,
      tamanho_da_caixa, tipo_de_tela, tamanho_display,
      pedometro, monitoramento_de_sono, saude_feminina, ecg, pressao_arterial,
      frequencia_cardiaca, oxigenio_no_sangue,
      capacidade_da_bateria, duracao_da_bateria, acompanha_carregador,
      bluetooth, com_gps, com_wi_fi, rede_movel, com_nfc,
      memoria_interna, musica_local, leitor_de_ebooks, gravador_de_voz,
      com_chat_gpt, assistente_de_voz, controle_de_musica, aplicativo,
      cor_1, cor_2, cor_3, url
    ) VALUES (
      ${p.name}, ${p.slug}, ${p.description}, ${p.descricao_longa},
      ${p.image}, ${p.product_type}, ${p.vendor}, ${p.collections},
      ${p.price}, ${p.price_formatted}, ${p.compare_at_price}, ${p.compare_at_price_formatted},
      ${p.seo_title}, ${p.seo_description},
      ${p.webflow_collection_id}, ${p.webflow_locale_id}, ${p.webflow_item_id},
      ${p.shopify_id}, ${p.shpid},
      ${p.archived}, ${p.draft}, ${p.is_gift_card},
      ${p.created_on}, ${p.updated_on}, ${p.published_on},
      ${p.tamanho_da_caixa}, ${p.tipo_de_tela}, ${p.tamanho_display},
      ${p.pedometro}, ${p.monitoramento_de_sono}, ${p.saude_feminina},
      ${p.ecg}, ${p.pressao_arterial}, ${p.frequencia_cardiaca}, ${p.oxigenio_no_sangue},
      ${p.capacidade_da_bateria}, ${p.duracao_da_bateria}, ${p.acompanha_carregador},
      ${p.bluetooth}, ${p.com_gps}, ${p.com_wi_fi}, ${p.rede_movel}, ${p.com_nfc},
      ${p.memoria_interna}, ${p.musica_local}, ${p.leitor_de_ebooks}, ${p.gravador_de_voz},
      ${p.com_chat_gpt}, ${p.assistente_de_voz}, ${p.controle_de_musica}, ${p.aplicativo},
      ${p.cor_1}, ${p.cor_2}, ${p.cor_3}, ${p.url}
    )
    ON CONFLICT (slug) DO NOTHING
  `;
}

// ---- Main ----

async function main() {
  console.log('📦 Lendo CSV...');
  const rows = await readCSV('./products.csv');
  console.log(`   Encontrados ${rows.length} produtos\n`);

  console.log('🗄️  Criando tabela (se não existir)...');
  // Lê e executa o schema.sql
  const { readFileSync } = await import('fs');
  const schema = readFileSync('./schema.sql', 'utf-8');
  // Executa cada statement separadamente
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log('   Tabela pronta!\n');

  console.log('📥 Importando produtos...');
  let success = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const product = mapRow(row);
      if (!product.name || !product.slug) {
        console.log(`   ⚠️  Pulando linha sem nome/slug`);
        continue;
      }
      await insertProduct(product);
      console.log(`   ✅ ${product.name}`);
      success++;
    } catch (err) {
      console.error(`   ❌ Erro: ${row['Name']} → ${err.message}`);
      errors++;
    }
  }

  console.log(`\n🎉 Importação concluída!`);
  console.log(`   ✅ ${success} produtos importados`);
  if (errors > 0) console.log(`   ❌ ${errors} erros`);
}

main().catch(console.error);
