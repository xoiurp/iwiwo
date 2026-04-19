// Captured from Figma MCP plugin:figma:figma get_design_context
// fileKey=V5L6H0bq5bgM362Lclwbdd nodeId=139:5  (Mobile → Apple Landing)
// Frame intrinsic size: 390×3789 (from get_metadata).
// Source of truth — DO NOT hand-edit. Re-run Figma MCP to refresh.
// NOTE: this mobile design ships hardcoded product copy (no {Nome do Produto}
// placeholder), so the mobile render is not templated per-product. To make it
// reusable across products, add {Nome do Produto}/{Subtítulo do produto}/
// {Descrição curta do produto} tokens in Figma and re-import.

const imgHeroProductImage = "https://www.figma.com/api/mcp/asset/f1901a67-4c83-4058-933b-bc47de7213a9";
const imgImageCompass = "https://www.figma.com/api/mcp/asset/5bcaea6e-1445-42ec-93c4-5e1923ad1ab3";
const imgImageInfiniteEdge = "https://www.figma.com/api/mcp/asset/c7a0382c-dee7-4f70-ab6b-479ce22c8c0a";
const imgImageDynamicIsland = "https://www.figma.com/api/mcp/asset/ba9e5977-3cc3-4f19-993a-e2961db49996";
const imgImage2GbMemory = "https://www.figma.com/api/mcp/asset/d62eef5f-3188-468f-86a9-d1bd969a1b07";
const imgHealthMockupWithOverlay = "https://www.figma.com/api/mcp/asset/a198bb69-72a2-4422-9f74-c567031c42b1";
const imgImageChatgpt = "https://www.figma.com/api/mcp/asset/489a5119-1f7c-4d02-a0da-2e3617a5d864";
const imgEllipse = "https://www.figma.com/api/mcp/asset/a4ecb245-c5df-489d-bad2-42d8dab17990";

export default function MobileAppleLanding() {
  return (
    <div className="bg-white content-stretch flex flex-col items-center overflow-clip relative rounded-[24px] size-full" data-node-id="139:5" data-name="Mobile → Apple Landing">
      <div className="bg-white content-stretch flex flex-col gap-[16px] items-center overflow-clip pb-[29px] pt-[48px] px-[24px] relative shrink-0 w-full" data-node-id="140:5" data-name="Hero Section">
        <p className="font-['Inter:Bold',sans-serif] font-bold leading-[40px] not-italic relative shrink-0 text-[#1a1b1f] text-[34px] text-center tracking-[-0.8px] w-full" data-node-id="140:6">
          Iwo W11 GPS 2GB
        </p>
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[#414753] text-[16px] text-center w-full" data-node-id="140:7">
          Leve, AMOLED, IA e muito mais.
        </p>
        <div className="h-[300px] relative rounded-[27px] shrink-0 w-full" data-node-id="140:13" data-name="Hero Product Image">
          <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[27px] size-full" src={imgHeroProductImage} />
        </div>
      </div>
      <div className="bg-[#f4f3f8] content-stretch flex flex-col gap-[24px] items-center overflow-clip px-[24px] py-[56px] relative shrink-0 w-full" data-node-id="141:5" data-name="Section - Integrated Compass">
        <div className="h-[300px] relative shrink-0 w-[260px]" data-node-id="141:6" data-name="image - compass">
          <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImageCompass} />
        </div>
        <div className="content-stretch flex flex-col gap-[12px] items-start not-italic overflow-clip relative shrink-0 w-full" data-node-id="141:7" data-name="Text block">
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#005db3] text-[12px] tracking-[1.2px] whitespace-nowrap" data-node-id="141:8">
            ORIENTAÇÃO
          </p>
          <div className="font-['Inter:Bold',sans-serif] font-bold leading-[0] min-w-full relative shrink-0 text-[#1a1b1f] text-[32px] tracking-[-0.8px] w-[min-content]" data-node-id="141:9">
            <p className="leading-[36px] mb-0">Bússola</p>
            <p className="leading-[36px]">Integrada.</p>
          </div>
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] min-w-full relative shrink-0 text-[#414753] text-[16px] w-[min-content]" data-node-id="141:10">
            Encontre seu norte com uma precisão sem precedentes. O sensor magnético integrado é calibrado para a perfeição absoluta, fornecendo dados em tempo real sobre um mostrador minimalista de alto contraste.
          </p>
        </div>
      </div>
      <div className="bg-white content-stretch flex flex-col gap-[24px] items-center overflow-clip px-[24px] py-[56px] relative shrink-0 w-full" data-node-id="142:5" data-name="Section - Infinite Edge">
        <div className="content-stretch flex flex-col gap-[12px] items-start not-italic overflow-clip relative shrink-0 w-full" data-node-id="142:6" data-name="Text block">
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#005db3] text-[12px] tracking-[1.2px] whitespace-nowrap" data-node-id="142:7">
            TELA
          </p>
          <div className="font-['Inter:Bold',sans-serif] font-bold leading-[0] min-w-full relative shrink-0 text-[#1a1b1f] text-[32px] tracking-[-0.8px] w-[min-content]" data-node-id="142:8">
            <p className="leading-[36px] mb-0">Tela de Borda</p>
            <p className="leading-[36px]">Infinita.</p>
          </div>
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] min-w-full relative shrink-0 text-[#414753] text-[16px] w-[min-content]" data-node-id="142:9">
            Eliminamos a moldura para criar uma tela que se funde com as bordas. O cristal de safira curvo proporciona uma experiência de toque fluida, tornando cada interação sem esforço.
          </p>
        </div>
        <div className="content-stretch flex flex-col h-[380px] items-center justify-center overflow-clip py-[16px] relative rounded-[24px] shrink-0 w-full" data-node-id="142:10" style={{ backgroundImage: "linear-gradient(48.01278750418335deg, rgb(233, 231, 237) 0%, rgba(233, 231, 237, 0) 100%)" }} data-name="Image Background">
          <div className="h-[348px] relative shrink-0 w-[220px]" data-node-id="142:11" data-name="image - infinite edge">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImageInfiniteEdge} />
          </div>
        </div>
      </div>
      <div className="bg-white content-stretch flex flex-col gap-[16px] items-center overflow-clip px-[16px] relative shrink-0 w-full" data-node-id="143:5" data-name="Cards Section">
        <div className="bg-[#f2f3f9] content-stretch flex flex-col items-center overflow-clip pt-[40px] px-[24px] relative rounded-[24px] shrink-0 w-full" data-node-id="143:6" data-name="Card - Ilha Dinâmica">
          <p className="font-['Sofia_Sans:Regular',sans-serif] font-normal leading-[24px] relative shrink-0 text-[#1a1b1f] text-[20px] text-center tracking-[-0.4px] whitespace-nowrap" data-node-id="143:7">
            Ilha Dinâmica
          </p>
          <p className="font-['Sofia_Sans:Regular',sans-serif] font-normal leading-[18px] relative shrink-0 text-[#1a1b1f] text-[14px] text-center tracking-[-0.28px] whitespace-nowrap" data-node-id="143:8">
            Notificações, Ligações, E-mails
          </p>
          <p className="font-['Sofia_Sans:Bold',sans-serif] font-bold leading-[34px] relative shrink-0 text-[#1a1b1f] text-[32px] text-center tracking-[-0.64px] whitespace-nowrap" data-node-id="143:9">
            Tudo em seu pulso
          </p>
          <div className="h-[24px] shrink-0 w-[10px]" data-node-id="143:10" data-name="Spacer" />
          <div className="h-[220px] relative shrink-0 w-[358px]" data-node-id="143:11" data-name="image - dynamic island">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img alt="" className="absolute h-full left-[-15.51%] max-w-none top-0 w-[131.01%]" src={imgImageDynamicIsland} />
            </div>
          </div>
        </div>
        <div className="bg-black content-stretch flex flex-col items-center overflow-clip pt-[40px] px-[24px] relative rounded-[24px] shrink-0 w-full" data-node-id="143:12" data-name="Card - 2GB Memória">
          <p className="font-['Sofia_Sans:Regular',sans-serif] font-normal leading-[24px] relative shrink-0 text-[20px] text-center text-white tracking-[-0.4px] whitespace-nowrap" data-node-id="143:13">
            2GB de Memória Interna
          </p>
          <p className="font-['Sofia_Sans:Regular',sans-serif] font-normal leading-[18px] relative shrink-0 text-[#2997ff] text-[14px] text-center tracking-[-0.28px] whitespace-nowrap" data-node-id="143:14">
            + Músicas + E-books + Conteúdo
          </p>
          <div className="h-[24px] shrink-0 w-[10px]" data-node-id="143:15" data-name="Spacer" />
          <div className="h-[240px] relative shrink-0 w-full" data-node-id="143:16" data-name="image - 2gb memory">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage2GbMemory} />
          </div>
        </div>
      </div>
      <div className="bg-[#e9e7ed] content-stretch flex flex-col gap-[24px] items-center overflow-clip px-[24px] py-[56px] relative shrink-0 w-full" data-node-id="144:5" data-name="Section - Health Tracking">
        <div className="content-stretch flex flex-col gap-[12px] items-center not-italic overflow-clip relative shrink-0 text-center w-full" data-node-id="144:6" data-name="Header">
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#005db3] text-[12px] tracking-[1.2px] whitespace-nowrap" data-node-id="144:7">
            BEM-ESTAR
          </p>
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[34px] min-w-full relative shrink-0 text-[#1a1b1f] text-[30px] tracking-[-0.8px] w-[min-content]" data-node-id="144:8">
            Acompanhamento Avançado de Saúde.
          </p>
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] min-w-full relative shrink-0 text-[#414753] text-[16px] w-[min-content]" data-node-id="144:9">
            Monitoramento vital contínuo integrado perfeitamente ao seu dia. A óptica de precisão lê o oxigênio no sangue, a frequência cardíaca e as métricas de sono com precisão de nível clínico.
          </p>
        </div>
        <div className="h-[280px] overflow-clip relative rounded-[20px] shrink-0 w-full" data-node-id="144:10" data-name="Health Mockup with Overlay">
          <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[20px] size-full" src={imgHealthMockupWithOverlay} />
          <div className="absolute bg-[rgba(255,255,255,0.92)] content-stretch flex gap-[10px] items-center left-[16px] overflow-clip pl-[12px] pr-[16px] py-[10px] rounded-[16px] shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] top-[178px]" data-node-id="144:11" data-name="Heart Rate Overlay">
            <div className="relative shrink-0 size-[20px]" data-node-id="144:12" data-name="Ellipse">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse} />
            </div>
            <div className="content-stretch flex flex-col gap-[2px] items-start not-italic overflow-clip relative shrink-0 whitespace-nowrap" data-node-id="144:13" data-name="Text column">
              <p className="font-['Inter:Medium',sans-serif] font-medium leading-[14px] relative shrink-0 text-[#5f5e60] text-[11px] tracking-[0.5px]" data-node-id="144:14">
                FREQUÊNCIA CARDÍACA
              </p>
              <div className="content-stretch flex gap-[4px] items-end overflow-clip relative shrink-0" data-node-id="144:15" data-name="Frame">
                <p className="font-['Inter:Bold',sans-serif] font-bold leading-[26px] relative shrink-0 text-[#1a1b1f] text-[22px]" data-node-id="144:16">
                  68
                </p>
                <p className="font-['Inter:Regular',sans-serif] font-normal leading-[18px] relative shrink-0 text-[#5f5e60] text-[12px]" data-node-id="144:17">
                  bpm
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-[#e9e7ed] content-stretch flex flex-col gap-[20px] items-center overflow-clip px-[24px] py-[56px] relative shrink-0 w-full" data-node-id="145:5" data-name="Section - ChatGPT">
        <div className="content-stretch flex flex-col gap-[12px] items-center not-italic overflow-clip relative shrink-0 text-center w-full" data-node-id="145:6" data-name="Header">
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#005db3] text-[12px] tracking-[1.2px] whitespace-nowrap" data-node-id="145:7">
            INTELIGÊNCIA ARTIFICIAL
          </p>
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[34px] min-w-full relative shrink-0 text-[#1a1b1f] text-[30px] tracking-[-0.8px] w-[min-content]" data-node-id="145:8">
            ChatGPT em seu pulso
          </p>
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] min-w-full relative shrink-0 text-[#414753] text-[16px] w-[min-content]" data-node-id="145:9">
            Faça perguntas e receba respostas em tempo real.
          </p>
        </div>
        <div className="h-[280px] relative rounded-[20px] shrink-0 w-full" data-node-id="145:10" data-name="image - chatgpt">
          <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[20px] size-full" src={imgImageChatgpt} />
        </div>
      </div>
    </div>
  );
}
